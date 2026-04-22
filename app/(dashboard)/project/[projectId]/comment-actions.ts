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
import { sendMentionNotification } from '@/lib/email'
import { extractStoragePaths, COMMENT_IMAGES_BUCKET } from '@/lib/utils/storage'

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
  input: { issue_id: string; contentJson: string; projectId: string }
): Promise<ServiceResultRaw<CommentRaw>> {
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()
  const content = JSON.parse(input.contentJson) as JSONContent

  const { data, error } = await createCommentService(supabase, user.id, { issue_id: input.issue_id, content })
  if (error || !data) return { data: null, error }

  // Fire mention notifications in the background (don't block the response)
  void sendMentionEmails({ supabase, content, authorId: user.id, issueId: input.issue_id, projectId: input.projectId })

  return { data: { ...data, contentJson: JSON.stringify(data.content) }, error: null }
}

async function sendMentionEmails({
  supabase,
  content,
  authorId,
  issueId,
  projectId,
}: {
  supabase: ReturnType<typeof createAdminClient>
  content: JSONContent
  authorId: string
  issueId: string
  projectId: string
}) {
  try {
    const mentionedIds = extractMentionIds(content)
    if (mentionedIds.length === 0) return

    // Fetch author name, issue details, and mentioned users' emails in parallel
    const [{ data: authorProfile }, { data: issue }, { data: mentionedProfiles }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', authorId).single(),
      supabase.from('issues').select('key, title').eq('id', issueId).single(),
      supabase.from('profiles').select('id, email, full_name').in('id', mentionedIds),
    ])

    if (!issue || !mentionedProfiles) return

    const authorName = authorProfile?.full_name ?? 'Alguien'
    const commentSnippet = extractTextSnippet(content)

    await Promise.all(
      mentionedProfiles
        .filter((p) => p.id !== authorId) // don't notify self-mentions
        .map((p) =>
          sendMentionNotification({
            toEmail: p.email,
            toName: p.full_name ?? p.email,
            mentionedByName: authorName,
            issueKey: issue.key,
            issueTitle: issue.title,
            projectId,
            commentSnippet,
          })
        )
    )
  } catch (err) {
    console.error('[sendMentionEmails]', err)
  }
}

/** Walks the Tiptap JSON tree and collects all mention node IDs. */
function extractMentionIds(content: JSONContent): string[] {
  const ids: string[] = []
  function walk(node: JSONContent) {
    if (node.type === 'mention' && typeof node.attrs?.id === 'string') {
      ids.push(node.attrs.id)
    }
    node.content?.forEach(walk)
  }
  walk(content)
  return [...new Set(ids)] // deduplicate
}

/** Extracts a plain-text snippet (max 200 chars) from Tiptap JSON for the email body. */
function extractTextSnippet(content: JSONContent, max = 200): string {
  const parts: string[] = []
  function walk(node: JSONContent) {
    if (node.type === 'text') parts.push(node.text ?? '')
    else if (node.type === 'mention') parts.push(`@${node.attrs?.label ?? ''}`)
    node.content?.forEach(walk)
  }
  walk(content)
  const text = parts.join('').trim()
  return text.length > max ? text.slice(0, max) + '…' : text
}

export async function deleteCommentAction(
  commentId: string
): Promise<{ data: null; error: string | null }> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()

  // Fetch the comment content to extract any embedded image URLs before deleting
  const { data: row } = await supabase
    .from('comments')
    .select('content')
    .eq('id', commentId)
    .single()

  if (row?.content) {
    const imagePaths = extractStoragePaths(row.content as JSONContent)
    if (imagePaths.length > 0) {
      await supabase.storage.from(COMMENT_IMAGES_BUCKET).remove(imagePaths)
    }
  }

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
