/**
 * issues.service.ts — capa de acceso a datos para issues/tickets.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { ServiceResult } from '@/types/common.types'
import type { Issue, IssueCreate, IssueUpdate, IssueWithDetails } from '@/types/issue.types'
import type { JSONContent } from '@tiptap/core'
import { extractStoragePaths, COMMENT_IMAGES_BUCKET } from '@/lib/utils/storage'

type Client = SupabaseClient<Database>

type RawIssue = {
  id: string
  project_id: string
  key: string
  title: string
  description: string | null
  status: string
  priority: string
  type: string
  assignee_id: string | null
  reporter_id: string
  position: number
  due_date: string | null
  start_date: string | null
  sprint_id: string | null
  epic_id: string | null
  slack_thread: string | null
  pause_reason: string | null
  created_at: string
  updated_at: string
  assignee: { id: string; full_name: string | null; avatar_url: string | null } | null
  reporter: { id: string; full_name: string | null; avatar_url: string | null } | null
  epic: { id: string; name: string; color: string } | null
  comments: { count: number }[]
}

export async function getIssues(
  supabase: Client,
  projectId: string
): Promise<ServiceResult<IssueWithDetails[]>> {
  const { data, error } = await supabase
    .from('issues')
    .select(`
      *,
      assignee:profiles!issues_assignee_id_fkey(id, full_name, avatar_url),
      reporter:profiles!issues_reporter_id_fkey(id, full_name, avatar_url),
      epic:epics(id, name, color),
      comments(count)
    `)
    .eq('project_id', projectId)
    .order('position', { ascending: true })

  if (error) {
    return { data: null, error: 'Error al cargar los tickets.' }
  }

  const issues: IssueWithDetails[] = (data as unknown as RawIssue[]).map((row) => ({
    id: row.id,
    project_id: row.project_id,
    key: row.key,
    title: row.title,
    description: row.description,
    status: row.status as Issue['status'],
    priority: row.priority as Issue['priority'],
    type: row.type as Issue['type'],
    assignee_id: row.assignee_id,
    reporter_id: row.reporter_id,
    position: row.position,
    due_date: row.due_date,
    sprint_id: row.sprint_id,
    epic_id: row.epic_id,
    start_date: row.start_date,
    slack_thread: row.slack_thread,
    pause_reason: row.pause_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
    assignee: row.assignee,
    reporter: row.reporter ?? { id: row.reporter_id, full_name: null, avatar_url: null },
    epic: row.epic,
    comment_count: row.comments?.[0]?.count ?? 0,
  }))

  return { data: issues, error: null }
}

export async function getIssueById(
  supabase: Client,
  issueId: string
): Promise<ServiceResult<IssueWithDetails>> {
  const { data, error } = await supabase
    .from('issues')
    .select(`
      *,
      assignee:profiles!issues_assignee_id_fkey(id, full_name, avatar_url),
      reporter:profiles!issues_reporter_id_fkey(id, full_name, avatar_url),
      epic:epics(id, name, color),
      comments(count)
    `)
    .eq('id', issueId)
    .single()

  if (error) return { data: null, error: 'Ticket not found.' }

  const row = data as unknown as RawIssue
  return {
    data: {
      id: row.id,
      project_id: row.project_id,
      key: row.key,
      title: row.title,
      description: row.description,
      status: row.status as Issue['status'],
      priority: row.priority as Issue['priority'],
      type: row.type as Issue['type'],
      assignee_id: row.assignee_id,
      reporter_id: row.reporter_id,
      position: row.position,
      due_date: row.due_date,
      start_date: row.start_date,
      sprint_id: row.sprint_id,
      epic_id: row.epic_id,
      slack_thread: row.slack_thread,
      pause_reason: row.pause_reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
      assignee: row.assignee,
      reporter: row.reporter ?? { id: row.reporter_id, full_name: null, avatar_url: null },
      epic: row.epic,
      comment_count: row.comments?.[0]?.count ?? 0,
    },
    error: null,
  }
}

export async function createIssue(
  supabase: Client,
  userId: string,
  data: IssueCreate
): Promise<ServiceResult<Issue>> {
  const { data: result, error } = await supabase
    .from('issues')
    .insert({
      project_id: data.project_id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      status: data.status ?? 'todo',
      priority: data.priority ?? 'medium',
      type: data.type ?? 'task',
      assignee_id: data.assignee_id ?? null,
      reporter_id: userId,
      due_date: data.due_date ?? null,
      ...(data.sprint_id !== undefined && { sprint_id: data.sprint_id }),
      epic_id: data.epic_id ?? null,
      slack_thread: data.slack_thread ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[createIssue] Supabase error:', error)
    return { data: null, error: 'Error al crear el ticket.' }
  }

  return { data: result as unknown as Issue, error: null }
}

export async function updateIssue(
  supabase: Client,
  issueId: string,
  data: IssueUpdate
): Promise<ServiceResult<Issue>> {
  // If description is changing, clean up removed images from Storage
  if (data.description !== undefined) {
    const { data: current } = await supabase
      .from('issues')
      .select('description')
      .eq('id', issueId)
      .single()

    const oldPaths = current?.description
      ? (() => { try { return extractStoragePaths(JSON.parse(current.description) as JSONContent) } catch { return [] } })()
      : []

    const newPaths = data.description
      ? (() => { try { return extractStoragePaths(JSON.parse(data.description) as JSONContent) } catch { return [] } })()
      : []

    const removed = oldPaths.filter((p) => !newPaths.includes(p))
    if (removed.length > 0) {
      await supabase.storage.from(COMMENT_IMAGES_BUCKET).remove(removed)
    }
  }

  const { data: result, error } = await supabase
    .from('issues')
    .update({
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.assignee_id !== undefined && { assignee_id: data.assignee_id }),
      ...(data.due_date !== undefined && { due_date: data.due_date }),
      ...(data.position !== undefined && { position: data.position }),
      ...(data.sprint_id !== undefined && { sprint_id: data.sprint_id }),
      ...(data.epic_id !== undefined && { epic_id: data.epic_id }),
      ...(data.start_date !== undefined && { start_date: data.start_date }),
      ...(data.slack_thread !== undefined && { slack_thread: data.slack_thread }),
      ...(data.pause_reason !== undefined && { pause_reason: data.pause_reason }),
    })
    .eq('id', issueId)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Error al actualizar el ticket.' }
  }

  return { data: result as unknown as Issue, error: null }
}

export async function deleteIssue(
  supabase: Client,
  issueId: string
): Promise<ServiceResult<null>> {
  // Clean up Storage images from comments and description before deleting
  const { data: issue } = await supabase
    .from('issues')
    .select('description')
    .eq('id', issueId)
    .single()

  const { data: comments } = await supabase
    .from('comments')
    .select('content')
    .eq('issue_id', issueId)

  const paths: string[] = []

  if (issue?.description) {
    try { paths.push(...extractStoragePaths(JSON.parse(issue.description) as JSONContent)) } catch {}
  }
  for (const c of comments ?? []) {
    if (c.content) paths.push(...extractStoragePaths(c.content as JSONContent))
  }

  if (paths.length > 0) {
    await supabase.storage.from(COMMENT_IMAGES_BUCKET).remove(paths)
  }

  const { error } = await supabase.from('issues').delete().eq('id', issueId)

  if (error) {
    return { data: null, error: 'Error al eliminar el ticket.' }
  }

  return { data: null, error: null }
}
