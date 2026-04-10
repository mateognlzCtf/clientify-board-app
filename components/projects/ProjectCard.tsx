'use client'

/**
 * ProjectCard — tarjeta de un proyecto en el dashboard.
 *
 * Muestra: nombre, clave, descripción, avatares de miembros, issues abiertas.
 * Acciones: ir al tablero, editar (owners/admins), eliminar (solo owner).
 */
import Link from 'next/link'
import { MoreHorizontal, Pencil, Trash2, Users, FolderKanban } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import type { ProjectWithMembers } from '@/services/projects.service'

interface ProjectCardProps {
  project: ProjectWithMembers
  currentUserId: string
  onEdit: (project: ProjectWithMembers) => void
  onDelete: (project: ProjectWithMembers) => void
}

export function ProjectCard({
  project,
  currentUserId,
  onEdit,
  onDelete,
}: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const currentMember = project.members.find((m) => m.user_id === currentUserId)
  const canEdit = currentMember?.role === 'owner' || currentMember?.role === 'admin'
  const canDelete = currentMember?.role === 'owner'

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Mostrar hasta 4 avatares, luego "+N"
  const visibleMembers = project.members.slice(0, 4)
  const extraCount = Math.max(0, project.members.length - 4)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all group flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/project/${project.id}`}
            className="font-semibold text-gray-900 hover:text-blue-600 transition-colors text-[15px] leading-snug block truncate"
          >
            {project.name}
          </Link>
          <span className="inline-block mt-1 text-[11px] font-mono font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            {project.key}
          </span>
        </div>

        {/* Actions menu */}
        {(canEdit || canDelete) && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                'p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors',
                'opacity-0 group-hover:opacity-100',
                menuOpen && 'opacity-100'
              )}
              aria-label="Acciones del proyecto"
            >
              <MoreHorizontal size={16} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-10 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                {canEdit && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onEdit(project)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Pencil size={14} />
                    Editar
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete(project)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {project.description ? (
        <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 flex-1">
          {project.description}
        </p>
      ) : (
        <p className="text-sm text-gray-300 italic flex-1">Sin descripción</p>
      )}

      {/* Footer: members + issue count */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        {/* Member avatars */}
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-2">
            {visibleMembers.map((member) => (
              <MemberAvatar key={member.id} member={member} />
            ))}
          </div>
          {extraCount > 0 && (
            <span className="text-xs text-gray-400 font-medium ml-1">
              +{extraCount}
            </span>
          )}
        </div>

        {/* Issue count */}
        <Link
          href={`/project/${project.id}/list`}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors"
        >
          <FolderKanban size={13} />
          <span>
            {project.open_issue_count === 0
              ? 'Sin issues abiertas'
              : `${project.open_issue_count} ${project.open_issue_count === 1 ? 'issue abierta' : 'issues abiertas'}`}
          </span>
        </Link>
      </div>
    </div>
  )
}

function MemberAvatar({
  member,
}: {
  member: ProjectWithMembers['members'][number]
}) {
  const profile = member.profile
  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?'

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.full_name ?? 'Miembro'}
        title={profile.full_name ?? 'Miembro'}
        className="h-6 w-6 rounded-full ring-2 ring-white object-cover"
      />
    )
  }

  return (
    <div
      title={profile?.full_name ?? 'Miembro'}
      className="h-6 w-6 rounded-full ring-2 ring-white bg-blue-500 flex items-center justify-center"
    >
      <span className="text-[9px] font-bold text-white">{initials}</span>
    </div>
  )
}
