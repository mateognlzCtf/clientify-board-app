'use server'

import { after } from 'next/server'
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
import { sendCommentCreatedEvent, type EventRecipient, type RecipientRole } from '@/lib/email'
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

  // Single consolidated comment.created webhook. Role priority: mentioned > assignee > reporter.
  // after() guarantees the fetch completes on Vercel serverless.
  const authorId = user.id
  const issueId = input.issue_id
  const projectId = input.projectId
  after(async () => {
    try {
      const mentionedIds = extractMentionIds(content)
      const { data: issue } = await supabase
        .from('issues')
        .select('key, title, assignee_id, reporter_id')
        .eq('id', issueId)
        .single()
      if (!issue) return

      // Assign roles by priority (first wins). Mentioned takes precedence over assignee/reporter.
      const roleByRecipientId = new Map<string, RecipientRole>()
      for (const id of mentionedIds) {
        if (id !== authorId && !roleByRecipientId.has(id)) roleByRecipientId.set(id, 'mentioned')
      }
      if (issue.assignee_id && issue.assignee_id !== authorId && !roleByRecipientId.has(issue.assignee_id)) {
        roleByRecipientId.set(issue.assignee_id, 'assignee')
      }
      if (issue.reporter_id && issue.reporter_id !== authorId && !roleByRecipientId.has(issue.reporter_id)) {
        roleByRecipientId.set(issue.reporter_id, 'reporter')
      }

      // Fire even when recipients is empty (commenting on your own ticket).
      // n8n decides per channel: skip email when empty, still post to Slack.
      const profileIds = [authorId, ...roleByRecipientId.keys()]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', profileIds)
      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
      const authorProfile = profileById.get(authorId)
      if (!authorProfile?.email) return

      const recipients: EventRecipient[] = []
      for (const [id, role] of roleByRecipientId) {
        const p = profileById.get(id)
        if (!p?.email) continue
        recipients.push({
          id: p.id,
          name: p.full_name ?? p.email,
          email: p.email,
          role,
        })
      }

      await sendCommentCreatedEvent({
        actor: {
          id: authorProfile.id,
          name: authorProfile.full_name ?? authorProfile.email,
          email: authorProfile.email,
        },
        issue: { id: issueId, key: issue.key, title: issue.title },
        comment: { snippet: extractTextSnippet(content) },
        recipients,
        projectId,
      })
    } catch (err) {
      console.error('[comment.created]', err)
    }
  })

  return { data: { ...data, contentJson: JSON.stringify(data.content) }, error: null }
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
  return [...new Set(ids)]
}

/** Extracts a plain-text snippet (max 200 chars) from Tiptap JSON for the email body. */
function extractTextSnippet(content: JSONContent, max = 200): string {
  const parts: string[] = []
  let imageCount = 0
  function walk(node: JSONContent) {
    if (node.type === 'text') parts.push(node.text ?? '')
    else if (node.type === 'mention') parts.push(`@${node.attrs?.label ?? ''}`)
    else if (node.type === 'image') imageCount++
    node.content?.forEach(walk)
  }
  walk(content)
  const text = parts.join('').trim()
  const truncated = text.length > max ? text.slice(0, max) + '…' : text
  if (imageCount > 0) {
    return truncated ? `${truncated} [📷 image]` : `📷 image`
  }
  return truncated
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
