import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import type { UserProfile } from '@/types/auth.types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Auto-accept any pending project invitations for this user
  if (user.email) {
    const adminClient = createAdminClient()
    const { data: pending } = await adminClient
      .from('pending_invitations')
      .select('*')
      .eq('email', user.email)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())

    if (pending && pending.length > 0) {
      await Promise.all(pending.map(async (inv) => {
        const { data: existing } = await adminClient
          .from('project_members')
          .select('id')
          .eq('project_id', inv.project_id)
          .eq('user_id', user.id)
          .single()

        if (!existing) {
          await adminClient.from('project_members').insert({
            project_id: inv.project_id,
            user_id: user.id,
            role: inv.role,
            invited_by: inv.invited_by,
          })
        }

        await adminClient
          .from('pending_invitations')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', inv.id)
      }))
    }
  }

  const [profileResult, membersResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('project_members')
      .select('project_id, role')
      .eq('user_id', user.id),
  ])

  const profile = profileResult.data as UserProfile | null

  const memberRows = (membersResult.data ?? []) as Array<{ project_id: string; role: string }>
  const projectIds = memberRows.map((m) => m.project_id)
  const ownerProjectIds = memberRows.filter((m) => m.role === 'owner').map((m) => m.project_id)

  const { data: projects } =
    projectIds.length > 0
      ? await supabase
          .from('projects')
          .select('id, name, key')
          .in('id', projectIds)
          .order('name')
      : { data: [] }

  const projectList = (projects ?? []) as Array<{
    id: string
    name: string
    key: string
  }>

  const adminEmails =
    process.env.PLATFORM_ADMIN_EMAILS?.split(',')
      .map((e) => e.trim())
      .filter(Boolean) ?? []
  const isSuperAdmin = user.email ? adminEmails.includes(user.email) : false

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        projects={projectList}
        ownerProjectIds={ownerProjectIds}
        isSuperAdmin={isSuperAdmin}
      />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Navbar profile={profile} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
