import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIssuesPaginated } from '@/services/issues.service'
import { IssuesClient } from './IssuesClient'

const SMALL_PROJECT_THRESHOLD = 500
const PAGE_SIZE = 100

interface Props {
  params: Promise<{ projectId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
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

  // Probe to detect project size + only the current user's membership row
  // (sprints/members/epics for the full list live in the layout context).
  const [{ data: probe }, { data: membership }] = await Promise.all([
    getIssuesPaginated(admin, projectId, { limit: SMALL_PROJECT_THRESHOLD, offset: 0, filters: {} }),
    admin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single(),
  ])

  const isSmallProject = !probe?.hasMore

  let initialIssues = probe?.data ?? []
  let initialHasMore = false

  if (!isSmallProject) {
    const { data: filtered } = await getIssuesPaginated(admin, projectId, {
      limit: PAGE_SIZE,
      offset: 0,
      filters: initialFilters,
    })
    initialIssues = filtered?.data ?? []
    initialHasMore = filtered?.hasMore ?? false
  }

  const canDelete = membership?.role === 'owner' || membership?.role === 'admin'

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
