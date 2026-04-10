import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { ServiceResult } from '@/types/common.types'
import type { ProjectMemberWithProfile, MemberRole } from '@/types/member.types'

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
  // Look up user by email in profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (profileError || !profile) {
    return { data: null, error: 'No user found with that email. They must sign up first.' }
  }

  // Check not already a member
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
