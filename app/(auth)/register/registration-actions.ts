'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createAdminActionTokens } from '@/services/admin.service'
import { sendUserRegisteredNotification } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function notifyAdminOfRegistrationAction(
  userId: string,
  fullName: string,
  email: string,
  skipPending: boolean = false
): Promise<void> {
  const adminEmails =
    process.env.PLATFORM_ADMIN_EMAILS?.split(',')
      .map((e) => e.trim())
      .filter(Boolean) ?? []

  if (adminEmails.length === 0 || skipPending) return

  const supabase = createAdminClient()

  await supabase.from('profiles').update({ status: 'pending' }).eq('id', userId)

  const { approveToken, rejectToken } = await createAdminActionTokens(supabase, userId)
  if (!approveToken || !rejectToken) return

  for (const adminEmail of adminEmails) {
    void sendUserRegisteredNotification({
      toEmail: adminEmail,
      newUserName: fullName,
      newUserEmail: email,
      approveUrl: `${APP_URL}/admin-action?token=${approveToken}`,
      rejectUrl: `${APP_URL}/admin-action?token=${rejectToken}`,
    })
  }
}

/**
 * Registration for platform-invited users.
 * Uses admin API to create the auth user with email already confirmed,
 * then accepts the invitation and sets status=active in one step.
 * The client still calls signInWithPassword after this to get a session.
 */
export async function registerStandardAction(
  email: string,
  password: string,
  fullName: string,
  skipPending: boolean = false
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()

  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName.trim() },
  })

  if (createError) {
    if (createError.message.toLowerCase().includes('already')) {
      return { error: 'An account with this email already exists. Try signing in.' }
    }
    return { error: 'Error creating account. Please try again.' }
  }

  const userId = userData.user?.id
  if (!userId) return { error: 'Error creating account. Please try again.' }

  await notifyAdminOfRegistrationAction(userId, fullName, email, skipPending)
  return { error: null }
}

export async function registerWithPlatformInviteAction(
  email: string,
  password: string,
  fullName: string,
  token: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()

  // Validate the invitation
  const { data: inv, error: invError } = await supabase
    .from('platform_invitations')
    .select('*')
    .eq('token', token)
    .single()

  if (invError || !inv) return { error: 'Invitation not found.' }
  if (inv.accepted_at) return { error: 'This invitation has already been used.' }
  if (new Date(inv.expires_at) < new Date()) return { error: 'This invitation has expired.' }
  if (inv.email.toLowerCase() !== email.toLowerCase()) {
    return { error: `This invitation was sent to ${inv.email}. Please use that email address.` }
  }

  // Create user with email already confirmed — bypasses Supabase email confirmation
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName.trim() },
  })

  let userId: string | null = userData?.user?.id ?? null

  if (createError) {
    if (!createError.message.toLowerCase().includes('already been registered') &&
        !createError.message.toLowerCase().includes('already registered')) {
      return { error: 'Error creating account. Please try again.' }
    }
    // User already exists — look up their profile
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()
    userId = existing?.id ?? null
  }

  if (!userId) return { error: 'Could not create account.' }

  // Set active + mark invitation accepted in parallel
  await Promise.all([
    supabase.from('profiles').update({ status: 'active' }).eq('id', userId),
    supabase.from('platform_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', inv.id),
  ])

  return { error: null }
}
