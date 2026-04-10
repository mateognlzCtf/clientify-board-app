'use server'

import { redirect } from 'next/navigation'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getComments as getCommentsService,
  createComment as createCommentService,
  deleteComment as deleteCommentService,
} from '@/services/comments.service'
import type { CommentWithAuthor } from '@/types/comment.types'
import type { JSONContent } from '@tiptap/core'

const COMMENT_IMAGES_BUCKET = 'comment-images'

// Server action boundary: content is transported as a JSON string to avoid
// Next.js server action serialization stripping nested `attrs` objects.
export type CommentRaw = Omit<CommentWithAuthor, 'content'> & { contentJson: string }

type ServiceResultRaw<T> = { data: T | null; error: string | null }

async function getAuthenticatedUser() {
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) redirect('/login')
  return user
}

export async function getCommentsAction(
  issueId: string
): Promise<ServiceResultRaw<CommentRaw[]>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const { data, error } = await getCommentsService(supabase, issueId)
  if (error || !data) return { data: null, error }
  return {
    data: data.map((c) => ({ ...c, contentJson: JSON.stringify(c.content) })),
    error: null,
  }
}

export async function createCommentAction(
  input: { issue_id: string; contentJson: string }
): Promise<ServiceResultRaw<CommentRaw>> {
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()
  const content = JSON.parse(input.contentJson) as JSONContent
  const { data, error } = await createCommentService(supabase, user.id, { issue_id: input.issue_id, content })
  if (error || !data) return { data: null, error }
  return { data: { ...data, contentJson: JSON.stringify(data.content) }, error: null }
}

export async function deleteCommentAction(
  commentId: string
): Promise<{ data: null; error: string | null }> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  return deleteCommentService(supabase, commentId)
}

export async function uploadCommentImageAction(
  formData: FormData
): Promise<{ data: string | null; error: string | null }> {
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()

  const file = formData.get('file') as File | null
  if (!file) return { data: null, error: 'No file provided.' }

  const path = `${user.id}/${Date.now()}.jpg`

  const { error } = await supabase.storage
    .from(COMMENT_IMAGES_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (error) {
    console.error('[uploadCommentImageAction]', error)
    return { data: null, error: 'Error uploading image.' }
  }

  const { data: urlData } = supabase.storage
    .from(COMMENT_IMAGES_BUCKET)
    .getPublicUrl(path)

  return { data: urlData.publicUrl, error: null }
}
