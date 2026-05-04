import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEpics } from '@/services/epics.service'
import { getProjectStatuses } from '@/services/project-statuses.service'
import { getProjectTypes } from '@/services/project-types.service'
import { getProjectLabels } from '@/services/project-labels.service'
import { SettingsClient } from './SettingsClient'

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { projectId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Owners, admins and super admins can access settings
  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  const isSuperAdmin = process.env.PLATFORM_ADMIN_EMAILS?.split(',')
    .map((e) => e.trim())
    .includes(user.email ?? '') ?? false

  if (member?.role !== 'owner' && member?.role !== 'admin' && !isSuperAdmin) {
    redirect(`/project/${projectId}/backlog`)
  }

  const admin = createAdminClient()
  const [{ data: epics }, { data: statuses }, { data: types }, { data: labels }] = await Promise.all([
    getEpics(admin, projectId),
    getProjectStatuses(admin, projectId),
    getProjectTypes(admin, projectId),
    getProjectLabels(admin, projectId),
  ])

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Project settings</h1>
      <SettingsClient
        projectId={projectId}
        epics={epics ?? []}
        statuses={statuses ?? []}
        types={types ?? []}
        labels={labels ?? []}
      />
    </div>
  )
}
