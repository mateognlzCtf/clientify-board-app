import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIssuesListLite } from '@/services/issues.service'
import type { IssueListLite, IssueWithDetails } from '@/types/issue.types'
import { KanbanBoard } from './KanbanBoard'

interface Props {
  params: Promise<{ projectId: string }>
}

// Board doesn't render description / start_date / slack_thread / resolved_at,
// so we fetch the lite payload (~85% smaller than the full one) and pad the
// missing fields with null to keep IssueWithDetails consumers happy.
function liteToFull(lite: IssueListLite): IssueWithDetails {
  return {
    ...lite,
    description: null,
    start_date: null,
    slack_thread: null,
  }
}

// Upper bound on board size: we still load all tickets for the project in a
// single query (the board needs to distribute them across status columns), but
// the request stays sane for projects in the low thousands.
const BOARD_LIMIT = 5000

export default async function BoardPage({ params }: Props) {
  const { projectId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Sprints/members/epics live in the layout context (loaded once per project entry).
  // The board only fetches issues + the current user's membership row.
  const [{ data: liteResult }, { data: membership }] = await Promise.all([
    getIssuesListLite(admin, projectId, { limit: BOARD_LIMIT, offset: 0 }),
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
    <KanbanBoard
      projectId={projectId}
      currentUserId={user.id}
      canDelete={canDelete}
      issues={issues}
    />
  )
}
