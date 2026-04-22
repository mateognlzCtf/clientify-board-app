import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listAllUsers, getPlatformInvitations, getAllProjects } from '@/services/admin.service'
import { AdminClient } from './AdminClient'

export default async function AdminPage() {
  const ssrSupabase = await createClient()
  const { data: { user } } = await ssrSupabase.auth.getUser()
  if (!user) redirect('/login')

  const adminEmails =
    process.env.PLATFORM_ADMIN_EMAILS?.split(',')
      .map((e) => e.trim())
      .filter(Boolean) ?? []

  if (!user.email || !adminEmails.includes(user.email)) {
    redirect('/dashboard')
  }

  const supabase = createAdminClient()
  const [usersResult, invitationsResult, projectsResult] = await Promise.all([
    listAllUsers(supabase),
    getPlatformInvitations(supabase),
    getAllProjects(supabase),
  ])

  const users = usersResult.data ?? []
  const invitations = invitationsResult.data ?? []
  const projects = projectsResult.data ?? []

  const active = users.filter((u) => u.status === 'active')
  const suspended = users.filter((u) => u.status === 'suspended')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Admin panel</h1>
      <AdminClient
        active={active}
        suspended={suspended}
        invitations={invitations}
        projects={projects}
        currentUserId={user.id}
      />
    </div>
  )
}
