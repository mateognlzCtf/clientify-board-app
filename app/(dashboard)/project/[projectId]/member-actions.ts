'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  inviteMember as inviteMemberService,
  updateMemberRole as updateMemberRoleService,
  removeMember as removeMemberService,
} from '@/services/members.service'
import type { MemberRole } from '@/types/member.types'
import type { ServiceResult } from '@/types/common.types'

async function getAuthenticatedUser() {
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) redirect('/login')
  return user
}

export async function inviteMemberAction(
  projectId: string,
  email: string,
  role: MemberRole
): Promise<ServiceResult<null>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await inviteMemberService(supabase, projectId, email, role)

  if (!result.error) revalidatePath(`/project/${projectId}/members`)

  return result
}

export async function updateMemberRoleAction(
  projectId: string,
  memberId: string,
  role: MemberRole
): Promise<ServiceResult<null>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await updateMemberRoleService(supabase, memberId, role)

  if (!result.error) revalidatePath(`/project/${projectId}/members`)

  return result
}

export async function removeMemberAction(
  projectId: string,
  memberId: string
): Promise<ServiceResult<null>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await removeMemberService(supabase, memberId)

  if (!result.error) revalidatePath(`/project/${projectId}/members`)

  return result
}
