/**
 * issues.service.ts — capa de acceso a datos para issues/tickets.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { ServiceResult } from '@/types/common.types'
import type { Issue, IssueCreate, IssueUpdate, IssueWithDetails } from '@/types/issue.types'

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
  sprint_id: string | null
  created_at: string
  updated_at: string
  assignee: { id: string; full_name: string | null; avatar_url: string | null } | null
  reporter: { id: string; full_name: string | null; avatar_url: string | null } | null
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
      reporter:profiles!issues_reporter_id_fkey(id, full_name, avatar_url)
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
    created_at: row.created_at,
    updated_at: row.updated_at,
    assignee: row.assignee,
    reporter: row.reporter ?? { id: row.reporter_id, full_name: null, avatar_url: null },
  }))

  return { data: issues, error: null }
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
      status: data.status ?? 'backlog',
      priority: data.priority ?? 'medium',
      type: data.type ?? 'task',
      assignee_id: data.assignee_id ?? null,
      reporter_id: userId,
      due_date: data.due_date ?? null,
      ...(data.sprint_id !== undefined && { sprint_id: data.sprint_id }),
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
  const { error } = await supabase.from('issues').delete().eq('id', issueId)

  if (error) {
    return { data: null, error: 'Error al eliminar el ticket.' }
  }

  return { data: null, error: null }
}
