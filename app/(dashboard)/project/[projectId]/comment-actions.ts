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
import { sendCommentCreatedEvent, sendCommentMentionedEvent, type EventRecipient } from '@/lib/email'
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

  // Fire mention + comment notifications in the background (don't block the response)
  void sendCommentEmails({ supabase, content, authorId: user.id, issueId: input.issue_id, projectId: input.projectId })

  return { data: { ...data, contentJson: JSON.stringify(data.content) }, error: null }
}

async function sendCommentEmails({
  supabase, content, authorId, issueId, projectId,
}: {
  supabase: ReturnType<typeof createAdminClient>
  content: JSONContent
  authorId: string
  issueId: string
  projectId: string
}) {
  try {
    const mentionedIds = extractMentionIds(content)
    const [{ data: author }, { data: issue }] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name').eq('id', authorId).single(),
      supabase.from('issues').select('id, key, title, assignee_id, reporter_id').eq('id', issueId).single(),
    ])
    if (!issue || !author) return

    const commentSnippet = extractTextSnippet(content)
    const images = extractImageUrls(content)
    const actor = { id: author.id, name: author.full_name ?? author.email, email: author.email }
    const issuePayload = { id: issue.id, key: issue.key, title: issue.title }
    const commentPayload = { snippet: commentSnippet, images }

    // Resolve all profiles needed in one query
    const profileIds = new Set<string>()
    mentionedIds.forEach((id) => { if (id !== authorId) profileIds.add(id) })
    if (issue.assignee_id && issue.assignee_id !== authorId) profileIds.add(issue.assignee_id)
    if (issue.reporter_id && issue.reporter_id !== authorId) profileIds.add(issue.reporter_id)

    const profiles = profileIds.size > 0
      ? (await supabase.from('profiles').select('id, email, full_name').in('id', Array.from(profileIds))).data ?? []
      : []
    const profileById = new Map(profiles.map((p) => [p.id, p]))

    // 1) Mention event — recipients are the mentioned users (excluding author)
    const mentionRecipientIds = mentionedIds.filter((id) => id !== authorId)
    if (mentionRecipientIds.length > 0) {
      const mentionRecipients: EventRecipient[] = mentionRecipientIds
        .map((id) => profileById.get(id))
        .filter((p): p is { id: string; email: string; full_name: string | null } => !!p)
        .map((p) => ({ email: p.email, name: p.full_name ?? p.email, role: 'mentioned' }))

      await sendCommentMentionedEvent({
        issue: issuePayload,
        actor,
        comment: commentPayload,
        recipients: mentionRecipients,
        projectId,
      })
    }

    // 2) Comment.created event — recipients are assignee + reporter (excluding author + already mentioned)
    const commentRecipientIds = new Set<string>()
    if (issue.assignee_id && issue.assignee_id !== authorId) commentRecipientIds.add(issue.assignee_id)
    if (issue.reporter_id && issue.reporter_id !== authorId) commentRecipientIds.add(issue.reporter_id)
    for (const id of mentionRecipientIds) commentRecipientIds.delete(id)

    const commentRecipients: EventRecipient[] = []
    for (const id of commentRecipientIds) {
      const p = profileById.get(id)
      if (!p) continue
      const role: 'assignee' | 'reporter' = id === issue.assignee_id ? 'assignee' : 'reporter'
      commentRecipients.push({ email: p.email, name: p.full_name ?? p.email, role })
    }

    await sendCommentCreatedEvent({
      issue: issuePayload,
      actor,
      comment: commentPayload,
      recipients: commentRecipients,
      projectId,
    })
  } catch (err) {
    console.error('[sendCommentEmails]', err)
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

/** Walks the Tiptap JSON tree and collects all image URLs (src) from image nodes. */
function extractImageUrls(content: JSONContent): string[] {
  const urls: string[] = []
  function walk(node: JSONContent) {
    if (node.type === 'image' && typeof node.attrs?.src === 'string') {
      urls.push(node.attrs.src)
    }
    node.content?.forEach(walk)
  }
  walk(content)
  return urls
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
