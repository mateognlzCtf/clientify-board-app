import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceResult } from '@/types/common.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface LinkedIssuePreview {
  link_id: string
  issue_id: string
  key: string
  title: string
  status: string
  type: string
  priority: string
  assignee: { full_name: string | null; avatar_url: string | null } | null
}

const ISSUE_FIELDS = 'id, key, title, status, type, priority, assignee:profiles!issues_assignee_id_fkey(full_name, avatar_url)'

export async function getIssueLinks(
  supabase: Client,
  issueId: string,
): Promise<LinkedIssuePreview[]> {
  const [{ data: asSource }, { data: asTarget }] = await Promise.all([
    supabase
      .from('issue_links')
      .select(`id, target:issues!issue_links_target_issue_id_fkey(${ISSUE_FIELDS})`)
      .eq('source_issue_id', issueId),
    supabase
      .from('issue_links')
      .select(`id, source:issues!issue_links_source_issue_id_fkey(${ISSUE_FIELDS})`)
      .eq('target_issue_id', issueId),
  ])

  const toPreview = (row: { id: string }, issue: Record<string, unknown>): LinkedIssuePreview => ({
    link_id: row.id,
    issue_id: issue.id as string,
    key: issue.key as string,
    title: issue.title as string,
    status: issue.status as string,
    type: issue.type as string,
    priority: issue.priority as string,
    assignee: (issue.assignee as { full_name: string | null; avatar_url: string | null } | null) ?? null,
  })

  const results: LinkedIssuePreview[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (asSource ?? [])) { const issue = (row as any).target; if (issue) results.push(toPreview(row, issue)) }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (asTarget ?? [])) { const issue = (row as any).source; if (issue) results.push(toPreview(row, issue)) }
  return results
}

export async function createIssueLink(
  supabase: Client,
  sourceIssueId: string,
  targetIssueId: string,
  createdBy: string,
): Promise<ServiceResult<{ link_id: string }>> {
  const { data, error } = await supabase
    .from('issue_links')
    .insert({ source_issue_id: sourceIssueId, target_issue_id: targetIssueId, created_by: createdBy })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return { data: null, error: 'Already linked.' }
    return { data: null, error: 'Error creating link.' }
  }
  return { data: { link_id: data.id }, error: null }
}

export async function deleteIssueLink(
  supabase: Client,
  linkId: string,
): Promise<ServiceResult<null>> {
  const { error } = await supabase.from('issue_links').delete().eq('id', linkId)
  if (error) return { data: null, error: 'Error removing link.' }
  return { data: null, error: null }
}
