'use client'

/**
 * Sidebar — barra de navegación lateral colapsable.
 *
 * Recibe la lista de proyectos del usuario desde el DashboardLayout (Server Component)
 * para evitar hacer fetch en el cliente. La lógica de colapso es local con useState.
 */
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { signOutAction } from '@/app/auth-actions'

interface SidebarProject {
  id: string
  name: string
  key: string
}

interface SidebarProps {
  projects: SidebarProject[]
}

export function Sidebar({ projects }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
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
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronLeft size={14} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        <NavItem
          href="/dashboard"
          icon={<LayoutDashboard size={16} />}
          label="Dashboard"
          collapsed={collapsed}
          active={pathname === '/dashboard'}
        />

        {/* Projects section */}
        {projects.length > 0 && (
          <>
            {!collapsed && (
              <p className="px-2 pt-5 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Proyectos
              </p>
            )}
            {collapsed && <div className="pt-3" />}
            {projects.map((project) => (
              <NavItem
                key={project.id}
                href={`/project/${project.id}`}
                icon={<FolderKanban size={16} />}
                label={project.name}
                badge={project.key}
                collapsed={collapsed}
                active={pathname.startsWith(`/project/${project.id}`)}
              />
            ))}
          </>
        )}
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
            <span
              className={cn(
                'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded',
                active ? 'bg-blue-500 text-blue-100' : 'bg-gray-700 text-gray-400'
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}
