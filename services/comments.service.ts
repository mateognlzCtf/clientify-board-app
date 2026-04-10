import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { ServiceResult } from '@/types/common.types'
import type { CommentWithAuthor, CommentCreate } from '@/types/comment.types'
import type { JSONContent } from '@tiptap/react'

type Client = SupabaseClient<Database>

type RawComment = {
  id: string
  issue_id: string
  author_id: string
  content: JSONContent
  created_at: string
  updated_at: string
  author: { id: string; email: string; full_name: string | null; avatar_url: string | null } | null
}

export async function getComments(
  supabase: Client,
  issueId: string
): Promise<ServiceResult<CommentWithAuthor[]>> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, author:profiles!comments_author_id_fkey(id, email, full_name, avatar_url)')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true })

  if (error) {
    return { data: null, error: 'Error loading comments.' }
  }

  const comments: CommentWithAuthor[] = (data as unknown as RawComment[]).map((row) => ({
    id: row.id,
    issue_id: row.issue_id,
    author_id: row.author_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: row.author ?? { id: row.author_id, email: '', full_name: null, avatar_url: null },
  }))

  return { data: comments, error: null }
}

export async function createComment(
  supabase: Client,
  userId: string,
  data: CommentCreate
): Promise<ServiceResult<CommentWithAuthor>> {
  const { data: result, error } = await supabase
    .from('comments')
    .insert({
      issue_id: data.issue_id,
      author_id: userId,
      content: data.content as unknown as Database['public']['Tables']['comments']['Insert']['content'],
    })
    .select('*, author:profiles!comments_author_id_fkey(id, email, full_name, avatar_url)')
    .single()

  if (error) {
    console.error('[createComment]', error)
    return { data: null, error: 'Error creating comment.' }
  }

  const raw = result as unknown as RawComment
  return {
    data: {
      id: raw.id,
      issue_id: raw.issue_id,
      author_id: raw.author_id,
      content: raw.content,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      author: raw.author ?? { id: raw.author_id, email: '', full_name: null, avatar_url: null },
    },
    error: null,
  }
}

export async function deleteComment(
  supabase: Client,
  commentId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId)

  if (error) {
    return { data: null, error: 'Error deleting comment.' }
  }

  return { data: null, error: null }
}
