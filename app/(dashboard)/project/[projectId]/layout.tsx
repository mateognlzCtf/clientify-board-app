import { redirect } from 'next/navigation'
import { LayoutList, Kanban, Users, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProject } from '@/services/projects.service'
import { getProjectStatuses } from '@/services/project-statuses.service'
import { getProjectTypes } from '@/services/project-types.service'
import { getProjectLabels } from '@/services/project-labels.service'
import { ProjectSettingsProvider } from '@/contexts/ProjectSettingsContext'
import { ProjectNav } from '@/components/layout/ProjectNav'
import { ProjectLayoutShell } from './ProjectLayoutShell'
import { NewTicketHeaderButton } from './NewTicketHeaderButton'

interface ProjectLayoutProps {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project, error } = await getProject(supabase, projectId)
  if (error || !project) redirect('/dashboard')

  const admin = createAdminClient()
  const [{ data: statuses }, { data: types }, { data: labels }] = await Promise.all([
    getProjectStatuses(admin, projectId),
    getProjectTypes(admin, projectId),
    getProjectLabels(admin, projectId),
  ])

  const navItems = [
    { href: `/project/${projectId}/backlog`, label: 'Backlog', icon: <BookOpen size={14} /> },
    { href: `/project/${projectId}/board`,   label: 'Board',   icon: <Kanban size={14} /> },
    { href: `/project/${projectId}/list`,    label: 'List',    icon: <LayoutList size={14} /> },
    { href: `/project/${projectId}/members`, label: 'Members', icon: <Users size={14} /> },
  ]

  const header = (
    <div className="border-b border-gray-200 bg-white px-6 pt-4 pb-0">
      <div className="flex items-center gap-2 mb-3">
        <h1 className="text-lg font-semibold text-gray-900">{project.name}</h1>
        <span className="text-xs font-mono font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          {project.key}
        </span>
        {project.description && (
          <span className="text-sm text-gray-400 ml-1 hidden sm:block truncate max-w-xs">
            — {project.description}
          </span>
        )}
        <NewTicketHeaderButton />
      </div>
      <ProjectNav items={navItems} />
    </div>
  )

  return (
    <ProjectLayoutShell header={header}>
      <ProjectSettingsProvider statuses={statuses ?? []} types={types ?? []} labels={labels ?? []}>
        {children}
      </ProjectSettingsProvider>
    </ProjectLayoutShell>
  )
}
