'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { notifyAdminOfRegistrationAction } from '../register/registration-actions'

export async function setPendingAndNotifyAction(
  userId: string,
  fullName: string,
  email: string
): Promise<void> {
  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', userId)
    .single()

  // Only set pending and notify if still in default active state
  if (profile?.status === 'active') {
    await notifyAdminOfRegistrationAction(userId, fullName, email, false)
  }
}
