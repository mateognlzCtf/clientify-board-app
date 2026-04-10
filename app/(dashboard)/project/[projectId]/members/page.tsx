import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProjectMembersWithProfile } from '@/services/members.service'
import { MembersClient } from './MembersClient'
import type { MemberRole } from '@/types/member.types'

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function MembersPage({ params }: Props) {
  const { projectId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await getProjectMembersWithProfile(supabase, projectId)
  if (!members) redirect('/dashboard')

  const currentMember = members.find((m) => m.user_id === user.id)
  if (!currentMember) redirect('/dashboard')

  return (
    <MembersClient
      projectId={projectId}
      currentUserId={user.id}
      currentUserRole={currentMember.role as MemberRole}
      members={members}
    />
  )
}
