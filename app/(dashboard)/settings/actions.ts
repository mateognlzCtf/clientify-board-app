'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ServiceResult } from '@/types/common.types'

async function getAuthenticatedUser() {
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) redirect('/login')
  return user
}

export async function updateProfileAction(data: {
  full_name: string
}): Promise<ServiceResult<null>> {
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: data.full_name.trim() || null })
    .eq('id', user.id)

  if (error) return { data: null, error: 'Error updating profile.' }

  revalidatePath('/settings')
  revalidatePath('/dashboard')

  return { data: null, error: null }
}
