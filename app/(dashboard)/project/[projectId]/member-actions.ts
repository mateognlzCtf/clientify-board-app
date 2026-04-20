'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  inviteMember as inviteMemberService,
  updateMemberRole as updateMemberRoleService,
  removeMember as removeMemberService,
  createPendingInvitation,
  cancelPendingInvitation,
  acceptInvitation,
} from '@/services/members.service'
import type { MemberRole } from '@/types/member.types'
import type { ServiceResult } from '@/types/common.types'
import { sendProjectInviteNotification, sendPendingInviteEmail } from '@/lib/email'

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

  // Check if user already exists in the system
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (profile) {
    // Existing user → add directly
    const result = await inviteMemberService(supabase, projectId, email, role)
    if (!result.error) {
      revalidatePath(`/project/${projectId}/members`)
      void notifyExistingUserInvite({ supabase, projectId, inviteeEmail: email, inviterId: user.id })
    }
    return result
  } else {
    // New user → create pending invitation
    const result = await createPendingInvitation(supabase, projectId, email, role, user.id)
    if (!result.error && result.data) {
      revalidatePath(`/project/${projectId}/members`)
      void notifyPendingInvite({ supabase, projectId, inviteeEmail: email, inviterId: user.id, token: result.data.token })
    }
    return { data: null, error: result.error }
  }
}

export async function cancelInvitationAction(
  projectId: string,
  invitationId: string
): Promise<ServiceResult<null>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await cancelPendingInvitation(supabase, invitationId)
  if (!result.error) revalidatePath(`/project/${projectId}/members`)
  return result
}

export async function acceptInvitationAction(
  token: string
): Promise<ServiceResult<{ projectId: string }>> {
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user || !user.email) return { data: null, error: 'Debes iniciar sesión para aceptar la invitación.' }

  const supabase = createAdminClient()
  const result = await acceptInvitation(supabase, token, user.id, user.email)

  if (!result.error && result.data) {
    revalidatePath(`/project/${result.data.projectId}/members`)
  }

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

// ── Email helpers ─────────────────────────────────────────────────────────────

async function notifyExistingUserInvite({
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
    console.error('[notifyExistingUserInvite]', err)
  }
}

async function notifyPendingInvite({
  supabase, projectId, inviteeEmail, inviterId, token,
}: {
  supabase: ReturnType<typeof createAdminClient>
  projectId: string
  inviteeEmail: string
  inviterId: string
  token: string
}) {
  try {
    const [{ data: project }, { data: inviter }] = await Promise.all([
      supabase.from('projects').select('name').eq('id', projectId).single(),
      supabase.from('profiles').select('full_name').eq('id', inviterId).single(),
    ])
    if (!project) return
    await sendPendingInviteEmail({
      toEmail: inviteeEmail,
      invitedByName: inviter?.full_name ?? 'Alguien',
      projectName: project.name,
      inviteToken: token,
    })
  } catch (err) {
    console.error('[notifyPendingInvite]', err)
  }
}
