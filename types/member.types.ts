export type MemberRole = 'owner' | 'admin' | 'member'

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: MemberRole
  invited_by: string | null
  created_at: string
}

export interface ProjectMemberWithProfile extends ProjectMember {
  profile: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
}

export interface MemberInvite {
  project_id: string
  email: string
  role: MemberRole
}
