/**
 * issues.service.ts — capa de acceso a datos para issues/tickets.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { ServiceResult } from '@/types/common.types'
import type { Issue, IssueCreate, IssueUpdate, IssueWithDetails, IssueListLite } from '@/types/issue.types'
import type { ProjectLabel } from '@/types/project-settings.types'
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
  resolved_at: string | null
  created_at: string
  updated_at: string
  assignee: { id: string; full_name: string | null; avatar_url: string | null; status: string } | null
  reporter: { id: string; full_name: string | null; avatar_url: string | null; status: string } | null
  epic: { id: string; name: string; color: string } | null
  comments: { count: number }[]
  issue_labels: { label: ProjectLabel }[] | null
}

export async function getIssues(
  supabase: Client,
  projectId: string
): Promise<ServiceResult<IssueWithDetails[]>> {
  const { data, error } = await supabase
    .from('issues')
    .select(`
      *,
      assignee:profiles!issues_assignee_id_fkey(id, full_name, avatar_url, status),
      reporter:profiles!issues_reporter_id_fkey(id, full_name, avatar_url, status),
      epic:epics(id, name, color),
      comments(count),
      issue_labels(label:project_labels(id, name, color, project_id, created_at))
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
    resolved_at: row.resolved_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    assignee: row.assignee,
    reporter: row.reporter ?? { id: row.reporter_id, full_name: null, avatar_url: null, status: 'active' },
    epic: row.epic,
    comment_count: row.comments?.[0]?.count ?? 0,
    labels: (row.issue_labels ?? []).map((il) => il.label),
  }))

  return { data: issues, error: null }
}

export interface IssuesListLiteFilters {
  statuses?: string[]
  priorities?: string[]
  types?: string[]
  assignees?: string[]
  labels?: string[]
  parents?: string[]
  search?: string
}

export interface IssuesListLiteOptions {
  limit?: number
  offset?: number
  filters?: IssuesListLiteFilters
}

export interface IssuesListLiteResult {
  data: IssueListLite[]
  hasMore: boolean
  total: number
}

type RawIssueListLite = {
  id: string
  project_id: string
  key: string
  title: string
  status: string
  priority: string
  type: string
  assignee_id: string | null
  reporter_id: string
  position: number
  sprint_id: string | null
  epic_id: string | null
  due_date: string | null
  pause_reason: string | null
  created_at: string
  updated_at: string
  assignee: { id: string; full_name: string | null; avatar_url: string | null; status: string } | null
  reporter: { id: string; full_name: string | null; avatar_url: string | null; status: string } | null
  epic: { id: string; name: string; color: string } | null
  comments: { count: number }[]
  issue_labels: { label: { id: string; name: string; color: string; project_id: string; created_at: string } }[] | null
}

/**
 * Minimal-payload issues query for list/table views. Skips description, full
 * reporter/epic joins, comments count, dates, etc. — saves ~90-95% of payload.
 */
export async function getIssuesListLite(
  supabase: Client,
  projectId: string,
  options: IssuesListLiteOptions = {}
): Promise<ServiceResult<IssuesListLiteResult>> {
  const limit = options.limit ?? 100
  const offset = options.offset ?? 0
  const filters = options.filters ?? {}

  let labelFilteredIds: string[] | null = null
  if (filters.labels && filters.labels.length > 0) {
    const { data: labelRows } = await supabase
      .from('issue_labels')
      .select('issue_id')
      .in('label_id', filters.labels)
    labelFilteredIds = [...new Set((labelRows ?? []).map((r) => r.issue_id))]
    if (labelFilteredIds.length === 0) {
      return { data: { data: [], hasMore: false, total: 0 }, error: null }
    }
  }

  let query = supabase
    .from('issues')
    .select(`
      id, project_id, key, title, status, priority, type, assignee_id, reporter_id, position, sprint_id, epic_id, due_date, pause_reason, created_at, updated_at,
      assignee:profiles!issues_assignee_id_fkey(id, full_name, avatar_url, status),
      reporter:profiles!issues_reporter_id_fkey(id, full_name, avatar_url, status),
      epic:epics(id, name, color),
      comments(count),
      issue_labels(label:project_labels(id, name, color, project_id, created_at))
    `, { count: 'exact' })
    .eq('project_id', projectId)

  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses)
  }
  if (filters.priorities && filters.priorities.length > 0) {
    query = query.in('priority', filters.priorities)
  }
  if (filters.types && filters.types.length > 0) {
    query = query.in('type', filters.types)
  }
  if (filters.assignees && filters.assignees.length > 0) {
    const includesUnassigned = filters.assignees.includes('__unassigned__')
    const userIds = filters.assignees.filter((id) => id !== '__unassigned__')
    if (includesUnassigned && userIds.length > 0) {
      query = query.or(`assignee_id.is.null,assignee_id.in.(${userIds.join(',')})`)
    } else if (includesUnassigned) {
      query = query.is('assignee_id', null)
    } else {
      query = query.in('assignee_id', userIds)
    }
  }
  if (filters.parents && filters.parents.length > 0) {
    const includesNone = filters.parents.includes('__none__')
    const epicIds = filters.parents.filter((id) => id !== '__none__')
    if (includesNone && epicIds.length > 0) {
      query = query.or(`epic_id.is.null,epic_id.in.(${epicIds.join(',')})`)
    } else if (includesNone) {
      query = query.is('epic_id', null)
    } else {
      query = query.in('epic_id', epicIds)
    }
  }
  if (labelFilteredIds !== null) {
    query = query.in('id', labelFilteredIds)
  }
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().replace(/[%_]/g, '\\$&')
    query = query.or(`title.ilike.%${q}%,key.ilike.%${q}%`)
  }

  query = query
    .order('position', { ascending: true })
    .range(offset, offset + limit)

  const { data, error, count } = await query
  if (error) {
    console.error('[getIssuesListLite]', error)
    return { data: null, error: 'Error al cargar los tickets.' }
  }

  const rows = data as unknown as RawIssueListLite[]
  const hasMore = rows.length > limit
  const sliced = hasMore ? rows.slice(0, limit) : rows

  const issues: IssueListLite[] = sliced.map((row) => ({
    id: row.id,
    project_id: row.project_id,
    key: row.key,
    title: row.title,
    status: row.status as IssueListLite['status'],
    priority: row.priority as IssueListLite['priority'],
    type: row.type as IssueListLite['type'],
    assignee_id: row.assignee_id,
    reporter_id: row.reporter_id,
    position: row.position,
    sprint_id: row.sprint_id,
    epic_id: row.epic_id,
    due_date: row.due_date,
    pause_reason: row.pause_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
    assignee: row.assignee,
    reporter: row.reporter ?? { id: row.reporter_id, full_name: null, avatar_url: null, status: 'active' },
    epic: row.epic,
    comment_count: row.comments?.[0]?.count ?? 0,
    labels: (row.issue_labels ?? []).map((il) => il.label),
  }))

  return { data: { data: issues, hasMore, total: count ?? sliced.length }, error: null }
}

/**
 * Fetch ONLY the heavy fields that the lite payload skips (description, dates,
 * slack thread, etc.). Used by callers that already have a lite issue cached
 * and just need to hydrate the modal/detail without re-fetching the joins
 * (assignee, epic, labels, comments) that are already in the lite cache.
 *
 * Much faster than `getIssueById` for this use case — small select, no joins.
 */
export interface IssueHeavyFields {
  description: string | null
  start_date: string | null
  slack_thread: string | null
  pause_reason: string | null
  resolved_at: string | null
}

export async function getIssueHeavyFields(
  supabase: Client,
  issueId: string,
): Promise<ServiceResult<IssueHeavyFields>> {
  const { data, error } = await supabase
    .from('issues')
    .select('description, start_date, slack_thread, pause_reason, resolved_at')
    .eq('id', issueId)
    .single()

  if (error || !data) {
    return { data: null, error: 'Ticket not found.' }
  }
  return { data: data as IssueHeavyFields, error: null }
}

/**
 * Returns ticket counts grouped by the given field, with the same filters as
 * the list view. Lightweight: only fetches the grouping column for every
 * matching row, then counts client-side. Used to show real per-group totals
 * even when the list itself is paginated.
 */
export type IssueGroupBy = 'status' | 'sprint' | 'assignee' | 'priority'

export async function getIssueGroupCounts(
  supabase: Client,
  projectId: string,
  options: { filters?: IssuesListLiteFilters; groupBy: IssueGroupBy }
): Promise<ServiceResult<Record<string, number>>> {
  const filters = options.filters ?? {}
  const fieldMap: Record<IssueGroupBy, 'status' | 'sprint_id' | 'assignee_id' | 'priority'> = {
    status: 'status',
    sprint: 'sprint_id',
    assignee: 'assignee_id',
    priority: 'priority',
  }
  const field = fieldMap[options.groupBy]
  const nullKey = options.groupBy === 'sprint' ? '__none__'
    : options.groupBy === 'assignee' ? '__unassigned__'
    : ''

  let labelFilteredIds: string[] | null = null
  if (filters.labels && filters.labels.length > 0) {
    const { data: labelRows } = await supabase
      .from('issue_labels')
      .select('issue_id')
      .in('label_id', filters.labels)
    labelFilteredIds = [...new Set((labelRows ?? []).map((r) => r.issue_id))]
    if (labelFilteredIds.length === 0) {
      return { data: {}, error: null }
    }
  }

  let query = supabase
    .from('issues')
    .select(field)
    .eq('project_id', projectId)

  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses)
  }
  if (filters.priorities && filters.priorities.length > 0) {
    query = query.in('priority', filters.priorities)
  }
  if (filters.types && filters.types.length > 0) {
    query = query.in('type', filters.types)
  }
  if (filters.assignees && filters.assignees.length > 0) {
    const includesUnassigned = filters.assignees.includes('__unassigned__')
    const userIds = filters.assignees.filter((id) => id !== '__unassigned__')
    if (includesUnassigned && userIds.length > 0) {
      query = query.or(`assignee_id.is.null,assignee_id.in.(${userIds.join(',')})`)
    } else if (includesUnassigned) {
      query = query.is('assignee_id', null)
    } else {
      query = query.in('assignee_id', userIds)
    }
  }
  if (filters.parents && filters.parents.length > 0) {
    const includesNone = filters.parents.includes('__none__')
    const epicIds = filters.parents.filter((id) => id !== '__none__')
    if (includesNone && epicIds.length > 0) {
      query = query.or(`epic_id.is.null,epic_id.in.(${epicIds.join(',')})`)
    } else if (includesNone) {
      query = query.is('epic_id', null)
    } else {
      query = query.in('epic_id', epicIds)
    }
  }
  if (labelFilteredIds !== null) {
    query = query.in('id', labelFilteredIds)
  }
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().replace(/[%_]/g, '\\$&')
    query = query.or(`title.ilike.%${q}%,key.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[getIssueGroupCounts]', error)
    return { data: null, error: 'Error al cargar contadores por grupo.' }
  }

  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as Array<Record<string, string | null>>) {
    const value = row[field]
    const key = value ?? nullKey
    counts[key] = (counts[key] ?? 0) + 1
  }

  return { data: counts, error: null }
}

export interface IssuesPageFilters {
  statuses?: string[]
  priorities?: string[]
  types?: string[]
  assignees?: string[] // may include '__unassigned__'
  labels?: string[]
  search?: string
}

export interface IssuesPageOptions {
  limit?: number
  offset?: number
  filters?: IssuesPageFilters
}

export interface IssuesPageResult {
  data: IssueWithDetails[]
  hasMore: boolean
}

/**
 * Paginated version of getIssues with server-side filtering.
 * Use for high-volume projects where loading all tickets is impractical.
 */
export async function getIssuesPaginated(
  supabase: Client,
  projectId: string,
  options: IssuesPageOptions = {}
): Promise<ServiceResult<IssuesPageResult>> {
  const limit = options.limit ?? 100
  const offset = options.offset ?? 0
  const filters = options.filters ?? {}

  // If filtering by labels, first resolve issue IDs that have any of those labels
  let labelFilteredIds: string[] | null = null
  if (filters.labels && filters.labels.length > 0) {
    const { data: labelRows } = await supabase
      .from('issue_labels')
      .select('issue_id')
      .in('label_id', filters.labels)
    labelFilteredIds = [...new Set((labelRows ?? []).map((r) => r.issue_id))]
    if (labelFilteredIds.length === 0) {
      return { data: { data: [], hasMore: false }, error: null }
    }
  }

  let query = supabase
    .from('issues')
    .select(`
      *,
      assignee:profiles!issues_assignee_id_fkey(id, full_name, avatar_url, status),
      reporter:profiles!issues_reporter_id_fkey(id, full_name, avatar_url, status),
      epic:epics(id, name, color),
      comments(count),
      issue_labels(label:project_labels(id, name, color, project_id, created_at))
    `)
    .eq('project_id', projectId)

  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses)
  }
  if (filters.priorities && filters.priorities.length > 0) {
    query = query.in('priority', filters.priorities)
  }
  if (filters.types && filters.types.length > 0) {
    query = query.in('type', filters.types)
  }
  if (filters.assignees && filters.assignees.length > 0) {
    const includesUnassigned = filters.assignees.includes('__unassigned__')
    const userIds = filters.assignees.filter((id) => id !== '__unassigned__')
    if (includesUnassigned && userIds.length > 0) {
      query = query.or(`assignee_id.is.null,assignee_id.in.(${userIds.join(',')})`)
    } else if (includesUnassigned) {
      query = query.is('assignee_id', null)
    } else {
      query = query.in('assignee_id', userIds)
    }
  }
  if (labelFilteredIds !== null) {
    query = query.in('id', labelFilteredIds)
  }
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().replace(/[%_]/g, '\\$&')
    query = query.or(`title.ilike.%${q}%,key.ilike.%${q}%`)
  }

  // Fetch limit + 1 to detect if more pages exist without an extra COUNT query
  query = query
    .order('position', { ascending: true })
    .range(offset, offset + limit)

  const { data, error } = await query
  if (error) {
    console.error('[getIssuesPaginated]', error)
    return { data: null, error: 'Error al cargar los tickets.' }
  }

  const rows = data as unknown as RawIssue[]
  const hasMore = rows.length > limit
  const sliced = hasMore ? rows.slice(0, limit) : rows

  const issues: IssueWithDetails[] = sliced.map((row) => ({
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
    resolved_at: row.resolved_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    assignee: row.assignee,
    reporter: row.reporter ?? { id: row.reporter_id, full_name: null, avatar_url: null, status: 'active' },
    epic: row.epic,
    comment_count: row.comments?.[0]?.count ?? 0,
    labels: (row.issue_labels ?? []).map((il) => il.label),
  }))

  return { data: { data: issues, hasMore }, error: null }
}

export async function getIssueById(
  supabase: Client,
  issueId: string
): Promise<ServiceResult<IssueWithDetails>> {
  const { data, error } = await supabase
    .from('issues')
    .select(`
      *,
      assignee:profiles!issues_assignee_id_fkey(id, full_name, avatar_url, status),
      reporter:profiles!issues_reporter_id_fkey(id, full_name, avatar_url, status),
      epic:epics(id, name, color),
      comments(count),
      issue_labels(label:project_labels(id, name, color, project_id, created_at))
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
      resolved_at: row.resolved_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      assignee: row.assignee,
      reporter: row.reporter ?? { id: row.reporter_id, full_name: null, avatar_url: null, status: 'active' },
      epic: row.epic,
      comment_count: row.comments?.[0]?.count ?? 0,
      labels: (row.issue_labels ?? []).map((il) => il.label),
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
      start_date: new Date().toISOString().slice(0, 10),
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

  const updatePayload: Record<string, unknown> = {
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
    ...(data.resolved_at !== undefined && { resolved_at: data.resolved_at }),
  }

  // Nothing to update on the issues table itself (e.g. only label_ids changed).
  // Return the current row so callers can keep handling label/relation updates.
  if (Object.keys(updatePayload).length === 0) {
    const { data: current, error: fetchError } = await supabase
      .from('issues').select('*').eq('id', issueId).single()
    if (fetchError) return { data: null, error: 'Error al cargar el ticket.' }
    return { data: current as unknown as Issue, error: null }
  }

  const { data: result, error } = await supabase
    .from('issues')
    .update(updatePayload as never)
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
