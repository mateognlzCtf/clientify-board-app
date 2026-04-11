import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIssues } from '@/services/issues.service'
import { getSprints } from '@/services/sprints.service'
import { getProjectMembers } from '@/services/projects.service'
import { getEpics } from '@/services/epics.service'
import { BacklogClient } from './BacklogClient'

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function BacklogPage({ params }: Props) {
  const { projectId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: issues }, { data: sprints }, { data: members }, { data: epics }] = await Promise.all([
    getIssues(admin, projectId),
    getSprints(admin, projectId),
    getProjectMembers(supabase, projectId),
    getEpics(admin, projectId),
  ])

  return (
    <BacklogClient
      projectId={projectId}
      currentUserId={user.id}
      issues={issues ?? []}
      sprints={sprints ?? []}
      members={members ?? []}
      epics={epics ?? []}
    />
  )
}
