import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIssuesListLite } from '@/services/issues.service'
import type { IssueListLite, IssueWithDetails } from '@/types/issue.types'
import { BacklogClient } from './BacklogClient'

interface Props {
  params: Promise<{ projectId: string }>
}

// Backlog doesn't render description / start_date / slack_thread / resolved_at,
// so we fetch the lite payload (~85% smaller) and pad the missing fields with
// null so IssueWithDetails consumers stay happy.
function liteToFull(lite: IssueListLite): IssueWithDetails {
  return {
    ...lite,
    description: null,
    start_date: null,
    slack_thread: null,
    resolved_at: null,
  }
}

const BACKLOG_LIMIT = 5000

export default async function BacklogPage({ params }: Props) {
  const { projectId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Sprints/members/epics live in the layout context (loaded once per project entry).
  const [{ data: liteResult }, { data: membership }] = await Promise.all([
    getIssuesListLite(admin, projectId, { limit: BACKLOG_LIMIT, offset: 0 }),
    admin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single(),
  ])

  const issues = (liteResult?.data ?? []).map(liteToFull)
  const canDelete = membership?.role === 'owner' || membership?.role === 'admin'

  return (
    <BacklogClient
      projectId={projectId}
      currentUserId={user.id}
      canDelete={canDelete}
      issues={issues}
    />
  )
}
