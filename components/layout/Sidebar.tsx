'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  FolderKanban,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Star,
  Plus,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { signOutAction } from '@/app/auth-actions'
import { Modal } from '@/components/ui/Modal'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { createProjectAction } from '@/app/(dashboard)/dashboard/actions'

interface SidebarProject {
  id: string
  name: string
  key: string
}

interface SidebarProps {
  projects: SidebarProject[]
}

export function Sidebar({ projects: initialProjects }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [projects, setProjects] = useState(initialProjects)
  const [createOpen, setCreateOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleCreate(data: Parameters<typeof createProjectAction>[0]) {
    const { data: newProject, error } = await createProjectAction(data)
    if (error || !newProject) return
    setProjects((prev) => [...prev, { id: newProject.id, name: newProject.name, key: newProject.key }])
    setCreateOpen(false)
    router.push(`/project/${newProject.id}`)
    router.refresh()
  }

  return (
    <>
      <aside
        className={cn(
          'flex flex-col bg-gray-900 text-white h-screen sticky top-0 shrink-0 transition-all duration-200',
          collapsed ? 'w-14' : 'w-56'
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center h-14 px-3 border-b border-gray-700/50 shrink-0',
            collapsed ? 'justify-center' : 'gap-2'
          )}
        >
          <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">C</span>
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-white truncate flex-1">
              Clientify Board
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-gray-700 transition-colors shrink-0"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">

          {/* For you */}
          <NavItem
            href="/dashboard"
            icon={<Star size={16} />}
            label="For you"
            collapsed={collapsed}
            active={pathname === '/dashboard'}
          />

          {/* Spaces section */}
          <div className={cn('pt-5', collapsed && 'pt-4')}>
            {!collapsed && (
              <div className="flex items-center justify-between px-2 pb-1">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Spaces
                </span>
                <button
                  onClick={() => setCreateOpen(true)}
                  title="New project"
                  className="p-0.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
            {collapsed && (
              <button
                onClick={() => setCreateOpen(true)}
                title="New project"
                className="w-full flex justify-center py-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-md transition-colors mb-1"
              >
                <Plus size={16} />
              </button>
            )}

            {projects.map((project) => (
              <NavItem
                key={project.id}
                href={`/project/${project.id}`}
                icon={<FolderKanban size={16} />}
                label={project.name}
                collapsed={collapsed}
                active={pathname.startsWith(`/project/${project.id}`)}
              />
            ))}

            {projects.length === 0 && !collapsed && (
              <p className="px-2 py-2 text-xs text-gray-500 italic">No projects yet.</p>
            )}
          </div>

          {/* Team section */}
          <div className="pt-4">
            {!collapsed && (
              <p className="px-2 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Team
              </p>
            )}
            <NavItem
              href="/team"
              icon={<Users size={16} />}
              label="Team"
              collapsed={collapsed}
              active={pathname === '/team'}
            />
          </div>
        </nav>

        {/* Footer */}
        <div className="shrink-0 p-2 border-t border-gray-700/50 space-y-0.5">
          <NavItem
            href="/settings"
            icon={<Settings size={16} />}
            label="Settings"
            collapsed={collapsed}
            active={pathname === '/settings'}
          />
          <form action={signOutAction}>
            <button
              type="submit"
              title={collapsed ? 'Sign out' : undefined}
              className={cn(
                'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
                'text-gray-400 hover:bg-gray-700/60 hover:text-red-400'
              )}
            >
              <span className="shrink-0"><LogOut size={16} /></span>
              {!collapsed && <span className="text-[13px]">Sign out</span>}
            </button>
          </form>
        </div>
      </aside>

      {/* Create project modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New project">
        <ProjectForm
          mode="create"
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>
    </>
  )
}

interface NavItemProps {
  href: string
  icon: React.ReactNode
  label: string
  badge?: string
  collapsed: boolean
  active: boolean
}

function NavItem({ href, icon, label, badge, collapsed, active }: NavItemProps) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
      )}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && (
        <>
          <span className="truncate flex-1 text-[13px]">{label}</span>
          {badge && (
            <span className={cn(
              'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded',
              active ? 'bg-blue-500 text-blue-100' : 'bg-gray-700 text-gray-400'
            )}>
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}
