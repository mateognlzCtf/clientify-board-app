import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { ServiceResult } from '@/types/common.types'
import type { ProjectMemberWithProfile, MemberRole, PendingInvitation } from '@/types/member.types'

type Client = SupabaseClient<Database>

type RawMember = {
  id: string
  project_id: string
  user_id: string
  role: string
  invited_by: string | null
  created_at: string
  profile: { id: string; email: string; full_name: string | null; avatar_url: string | null } | null
}

export async function getProjectMembersWithProfile(
  supabase: Client,
  projectId: string
): Promise<ServiceResult<ProjectMemberWithProfile[]>> {
  const { data, error } = await supabase
    .from('project_members')
    .select('*, profile:profiles!project_members_user_id_fkey(id, email, full_name, avatar_url)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) return { data: null, error: 'Error loading members.' }

  const members: ProjectMemberWithProfile[] = (data as unknown as RawMember[]).map((m) => ({
    id: m.id,
    project_id: m.project_id,
    user_id: m.user_id,
    role: m.role as MemberRole,
    invited_by: m.invited_by,
    created_at: m.created_at,
    profile: m.profile ?? { id: m.user_id, email: '', full_name: null, avatar_url: null },
  }))

  return { data: members, error: null }
}

export async function inviteMember(
  supabase: Client,
  projectId: string,
  email: string,
  role: MemberRole
): Promise<ServiceResult<null>> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (profileError || !profile) {
    return { data: null, error: 'No user found with that email.' }
  }

  const { data: existing } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', profile.id)
    .single()

  if (existing) {
    return { data: null, error: 'This user is already a member of the project.' }
  }

  const { error } = await supabase
    .from('project_members')
    .insert({ project_id: projectId, user_id: profile.id, role })

  if (error) return { data: null, error: 'Error adding member.' }

  return { data: null, error: null }
}

export async function getPendingInvitations(
  supabase: Client,
  projectId: string
): Promise<ServiceResult<PendingInvitation[]>> {
  const { data, error } = await supabase
    .from('pending_invitations')
    .select('*')
    .eq('project_id', projectId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: 'Error loading invitations.' }

  return {
    data: (data ?? []).map((row) => ({
      ...row,
      role: row.role as MemberRole,
    })),
    error: null,
  }
}

export async function createPendingInvitation(
  supabase: Client,
  projectId: string,
  email: string,
  role: MemberRole,
  invitedBy: string
): Promise<ServiceResult<PendingInvitation>> {
  // Check for existing invitation (any state)
  const { data: existing } = await supabase
    .from('pending_invitations')
    .select('id, expires_at, accepted_at')
    .eq('project_id', projectId)
    .eq('email', email)
    .single()

  if (existing) {
    const isExpired = new Date(existing.expires_at) < new Date()
    if (!isExpired && !existing.accepted_at) {
      return { data: null, error: 'There is already a pending invitation for this email.' }
    }
    // Expired or accepted → delete it so we can create a fresh one
    await supabase.from('pending_invitations').delete().eq('id', existing.id)
  }

  const { data, error } = await supabase
    .from('pending_invitations')
    .insert({ project_id: projectId, email, role, invited_by: invitedBy })
    .select()
    .single()

  if (error) {
    console.error('[createPendingInvitation] Supabase error:', error)
    return { data: null, error: 'Error creating invitation.' }
  }

  return { data: { ...(data as PendingInvitation), role: data.role as MemberRole }, error: null }
}

export async function cancelPendingInvitation(
  supabase: Client,
  invitationId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase
    .from('pending_invitations')
    .delete()
    .eq('id', invitationId)

  if (error) return { data: null, error: 'Error cancelling invitation.' }

  return { data: null, error: null }
}

export async function getInvitationByToken(
  supabase: Client,
  token: string
): Promise<ServiceResult<PendingInvitation & {
  project: { id: string; name: string } | null
  inviter: { full_name: string | null } | null
}>> {
  const { data, error } = await supabase
    .from('pending_invitations')
    .select(`
      *,
      project:projects!pending_invitations_project_id_fkey(id, name),
      inviter:profiles!pending_invitations_invited_by_fkey(full_name)
    `)
    .eq('token', token)
    .single()

  if (error || !data) return { data: null, error: 'Invitation not found.' }

  return {
    data: {
      ...(data as unknown as PendingInvitation & {
        project: { id: string; name: string } | null
        inviter: { full_name: string | null } | null
      }),
      role: data.role as MemberRole,
    },
    error: null,
  }
}

export async function acceptInvitation(
  supabase: Client,
  token: string,
  userId: string,
  userEmail: string
): Promise<ServiceResult<{ projectId: string }>> {
  const { data: inv, error: fetchError } = await supabase
    .from('pending_invitations')
    .select('*')
    .eq('token', token)
    .single()

  if (fetchError || !inv) return { data: null, error: 'Invitation not found.' }
  if (inv.accepted_at) return { data: null, error: 'This invitation has already been accepted.' }
  if (new Date(inv.expires_at) < new Date()) return { data: null, error: 'This invitation has expired.' }
  if (inv.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { data: null, error: `This invitation was sent to ${inv.email}. Please log in with that email.` }
  }

  // Check not already a member
  const { data: existing } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', inv.project_id)
    .eq('user_id', userId)
    .single()

  if (!existing) {
    const { error: insertError } = await supabase
      .from('project_members')
      .insert({ project_id: inv.project_id, user_id: userId, role: inv.role, invited_by: inv.invited_by })

    if (insertError) return { data: null, error: 'Error joining project.' }
  }

  await supabase
    .from('pending_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', inv.id)

  return { data: { projectId: inv.project_id }, error: null }
}

export async function updateMemberRole(
  supabase: Client,
  memberId: string,
  role: MemberRole
): Promise<ServiceResult<null>> {
  const { error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('id', memberId)

  if (error) return { data: null, error: 'Error updating role.' }

  return { data: null, error: null }
}

export async function removeMember(
  supabase: Client,
  memberId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', memberId)

  if (error) return { data: null, error: 'Error removing member.' }

  return { data: null, error: null }
}
