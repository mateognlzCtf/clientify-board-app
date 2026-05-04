import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProjectMembersWithProfile, getPendingInvitations } from '@/services/members.service'
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

  const isSuperAdmin = process.env.PLATFORM_ADMIN_EMAILS?.split(',')
    .map((e) => e.trim())
    .includes(user.email ?? '') ?? false

  const currentMember = members.find((m) => m.user_id === user.id)
  if (!currentMember && !isSuperAdmin) redirect('/dashboard')

  const adminSupabase = createAdminClient()
  const { data: pendingInvitations } = await getPendingInvitations(adminSupabase, projectId)

  const memberIds = members.map((m) => m.user_id)
  const { data: availableProfiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .not('id', 'in', `(${memberIds.join(',')})`)
    .order('full_name', { ascending: true })

  // Super admin not in project gets virtual 'admin' role
  const effectiveRole: MemberRole = (currentMember?.role as MemberRole) ?? 'admin'

  return (
    <MembersClient
      projectId={projectId}
      currentUserId={user.id}
      currentUserRole={effectiveRole}
      isSuperAdmin={isSuperAdmin}
      members={members}
      availableProfiles={availableProfiles ?? []}
      pendingInvitations={pendingInvitations ?? []}
    />
  )
}
