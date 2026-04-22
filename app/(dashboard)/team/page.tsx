import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TeamClient } from './TeamClient'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email, avatar_url, created_at')
    .eq('status', 'active')
    .order('full_name', { ascending: true })

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Workers</h1>
      </div>
      <TeamClient profiles={profiles ?? []} />
    </div>
  )
}
