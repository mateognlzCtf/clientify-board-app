import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIssuesListLite } from '@/services/issues.service'
import type { IssueListLite, IssueWithDetails } from '@/types/issue.types'
import { IssuesClient } from './IssuesClient'

const PAGE_SIZE = 50

interface Props {
  params: Promise<{ projectId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function liteToFull(lite: IssueListLite): IssueWithDetails {
  return {
    ...lite,
    description: null,
    start_date: null,
    slack_thread: null,
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
    parents: parseParam('parent'),
    defaults: parseParam('default'),
  }

  // Always paginated: fetch first page with the initial filters from the URL.
  const [{ data: firstPage }, { data: membership }] = await Promise.all([
    getIssuesListLite(admin, projectId, { limit: PAGE_SIZE, offset: 0, filters: initialFilters }),
    admin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single(),
  ])

  const initialIssues = (firstPage?.data ?? []).map(liteToFull)
  const initialHasMore = firstPage?.hasMore ?? false
  const initialTotal = firstPage?.total ?? 0
  const canDelete = membership?.role === 'owner' || membership?.role === 'admin'

  return (
    <div className="absolute inset-0 p-6 flex flex-col overflow-hidden">
      <IssuesClient
        projectId={projectId}
        currentUserId={user.id}
        canDelete={canDelete}
        issues={initialIssues}
        initialHasMore={initialHasMore}
        initialTotal={initialTotal}
        pageSize={PAGE_SIZE}
        initialFilters={initialFilters}
      />
    </div>
  )
}
