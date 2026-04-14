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
import { sendProjectInviteNotification } from '@/lib/email'

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
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await inviteMemberService(supabase, projectId, email, role)

  if (!result.error) {
    revalidatePath(`/project/${projectId}/members`)
    void notifyInvite({ supabase, projectId, inviteeEmail: email, inviterId: user.id })
  }

  return result
}

async function notifyInvite({
  supabase, projectId, inviteeEmail, inviterId,
}: {
  supabase: ReturnType<typeof createAdminClient>
  projectId: string
  inviteeEmail: string
  inviterId: string
}) {
  try {
    const [{ data: project }, { data: inviter }, { data: invitee }] = await Promise.all([
      supabase.from('projects').select('name').eq('id', projectId).single(),
      supabase.from('profiles').select('full_name').eq('id', inviterId).single(),
      supabase.from('profiles').select('email, full_name').eq('email', inviteeEmail).single(),
    ])
    if (!project || !invitee?.email) return
    await sendProjectInviteNotification({
      toEmail: invitee.email,
      toName: invitee.full_name ?? invitee.email,
      invitedByName: inviter?.full_name ?? 'Alguien',
      projectName: project.name,
      projectId,
    })
  } catch (err) {
    console.error('[notifyInvite]', err)
  }
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
