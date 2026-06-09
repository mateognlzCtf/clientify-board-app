import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIssues } from '@/services/issues.service'
import { KanbanBoard } from './KanbanBoard'

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function BoardPage({ params }: Props) {
  const { projectId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Sprints/members/epics live in the layout context (loaded once per project entry).
  // The board only fetches issues + the current user's membership row.
  const [{ data: issues }, { data: membership }] = await Promise.all([
    getIssues(admin, projectId),
    admin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single(),
  ])

  const canDelete = membership?.role === 'owner' || membership?.role === 'admin'

  return (
    <KanbanBoard
      projectId={projectId}
      currentUserId={user.id}
      canDelete={canDelete}
      issues={issues ?? []}
    />
  )
}
