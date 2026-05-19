import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIssueById } from '@/services/issues.service'
import { getSprints } from '@/services/sprints.service'
import { getProjectMembers } from '@/services/projects.service'
import { IssuePageClient } from './IssuePageClient'

interface Props {
  params: Promise<{ projectId: string; issueId: string }>
}

export default async function IssueFullPage({ params }: Props) {
  const { projectId, issueId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: issue, error }, { data: sprints }, { data: members }] = await Promise.all([
    getIssueById(admin, issueId),
    getSprints(admin, projectId),
    getProjectMembers(supabase, projectId),
  ])

  if (error || !issue) notFound()

  const currentMember = (members ?? []).find((m) => m.user_id === user.id)
  const canDelete = currentMember?.role === 'owner' || currentMember?.role === 'admin'

  return (
    <div className="w-full h-full px-8 py-6">
      <IssuePageClient
        issue={issue}
        projectId={projectId}
        currentUserId={user.id}
        canDelete={canDelete}
        sprints={sprints ?? []}
        members={members ?? []}
      />
    </div>
  )
}
