import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIssuesListLite } from '@/services/issues.service'
import type { IssueListLite, IssueWithDetails } from '@/types/issue.types'
import { IssuesClient } from './IssuesClient'

const SMALL_PROJECT_THRESHOLD = 500
const PAGE_SIZE = 100

interface Props {
  params: Promise<{ projectId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Hydrate the lite payload into the shape IssuesClient expects, with nulls
 * for fields the list view doesn't display (description, dates, reporter, etc).
 */
function liteToFull(lite: IssueListLite): IssueWithDetails {
  return {
    ...lite,
    description: null,
    start_date: null,
    slack_thread: null,
    pause_reason: null,
    resolved_at: null,
  }
}

export default async function IssuesListPage({ params, searchParams }: Props) {
  const { projectId } = await params
  const filtersParams = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  function parseParam(key: string): string[] {
    const val = filtersParams[key]
    if (!val) return []
    return Array.isArray(val) ? val : val.split(',').filter(Boolean)
  }

  const initialFilters = {
    statuses: parseParam('status'),
    priorities: parseParam('priority'),
    types: parseParam('type'),
    assignees: parseParam('assignee'),
    labels: parseParam('label'),
  }

  const [{ data: probe }, { data: membership }] = await Promise.all([
    getIssuesListLite(admin, projectId, { limit: SMALL_PROJECT_THRESHOLD, offset: 0, filters: {} }),
    admin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single(),
  ])

  const isSmallProject = !probe?.hasMore

  let initialLiteIssues = probe?.data ?? []
  let initialHasMore = false

  if (!isSmallProject) {
    const { data: filtered } = await getIssuesListLite(admin, projectId, {
      limit: PAGE_SIZE,
      offset: 0,
      filters: initialFilters,
    })
    initialLiteIssues = filtered?.data ?? []
    initialHasMore = filtered?.hasMore ?? false
  }

  const canDelete = membership?.role === 'owner' || membership?.role === 'admin'
  const initialIssues = initialLiteIssues.map(liteToFull)

  return (
    <div className="p-6">
      <IssuesClient
        projectId={projectId}
        currentUserId={user.id}
        canDelete={canDelete}
        issues={initialIssues}
        initialHasMore={initialHasMore}
        isSmallProject={isSmallProject}
        pageSize={PAGE_SIZE}
        initialFilters={initialFilters}
      />
    </div>
  )
}
