import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SettingsClient } from './SettingsClient'
import type { UserProfile } from '@/types/auth.types'

export const metadata: Metadata = {
  title: 'Settings',
}

export default async function SettingsPage() {
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) redirect('/login')

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, created_at, updated_at')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return <SettingsClient profile={profile as UserProfile} />
}
