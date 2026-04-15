'use client'

import { useState, useEffect, useRef } from 'react'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { ProjectMemberPreview } from '@/services/projects.service'

const MAX_AVATAR_VISIBLE = 5

export function AssigneeAvatars({
  members, activeIds, onToggle,
}: {
  members: ProjectMemberPreview[]
  activeIds: string[]
  onToggle: (userId: string) => void
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [dropdownOpen])

  const visible = members.slice(0, MAX_AVATAR_VISIBLE)
  const overflow = members.length - MAX_AVATAR_VISIBLE
  const unassignedActive = activeIds.includes('__unassigned__')

  return (
    <div className="flex items-center">
      {/* Unassigned bubble */}
      <button
        type="button"
        onClick={() => onToggle('__unassigned__')}
        title="Unassigned"
        className={cn(
          'relative h-7 w-7 rounded-full border-2 bg-gray-100 flex items-center justify-center shrink-0 transition-all',
          unassignedActive
            ? 'border-blue-500 ring-2 ring-blue-400 ring-offset-1'
            : 'border-white hover:border-blue-300'
        )}
        style={{ zIndex: members.length + 2 }}
      >
        <User size={13} className="text-gray-500" />
      </button>

      {/* Visible member avatars */}
      {visible.map((m, i) => {
        const isActive = activeIds.includes(m.user_id)
        const initials = m.profile?.full_name
          ? m.profile.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
          : '?'
        return (
          <button
            key={m.user_id}
            type="button"
            onClick={() => onToggle(m.user_id)}
            title={m.profile?.full_name ?? m.user_id}
            className={cn(
              'relative h-7 w-7 rounded-full border-2 bg-blue-500 flex items-center justify-center shrink-0 transition-all',
              isActive
                ? 'border-blue-500 ring-2 ring-blue-400 ring-offset-1'
                : 'border-white hover:border-blue-300'
            )}
            style={{ marginLeft: '-6px', zIndex: isActive ? MAX_AVATAR_VISIBLE + 1 : MAX_AVATAR_VISIBLE - i }}
          >
            {m.profile?.avatar_url ? (
              <img src={m.profile.avatar_url} className="h-full w-full rounded-full object-cover" alt="" />
            ) : (
              <span className="text-[10px] font-bold text-white">{initials}</span>
            )}
          </button>
        )
      })}

      {/* Overflow bubble — always shown; opens full member list dropdown */}
      <div ref={dropdownRef} className="relative" style={{ marginLeft: '-6px' }}>
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          title="All assignees"
          className={cn(
            'h-7 rounded-full border-2 px-1.5 bg-gray-100 flex items-center justify-center shrink-0 transition-all',
            dropdownOpen ? 'border-blue-400' : 'border-white hover:border-blue-300'
          )}
          style={{ minWidth: '28px' }}
        >
          <span className="text-[10px] font-bold text-gray-500">
            {overflow > 0 ? `+${overflow}` : '···'}
          </span>
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-xl border border-gray-200 shadow-2xl w-56 max-h-80 overflow-y-auto">
            <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 sticky top-0 bg-white">
              Assignees
            </p>
            <button
              type="button"
              onClick={() => onToggle('__unassigned__')}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors',
                unassignedActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <span className={cn(
                'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0',
                unassignedActive ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
              )}>
                {unassignedActive && <span className="text-white text-[9px] font-bold">✓</span>}
              </span>
              <div className="h-5 w-5 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                <User size={10} className="text-gray-500" />
              </div>
              <span className="truncate">Unassigned</span>
            </button>
            {members.map((m) => {
              const isActive = activeIds.includes(m.user_id)
              const initials = m.profile?.full_name
                ? m.profile.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
                : '?'
              return (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => onToggle(m.user_id)}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors',
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <span className={cn(
                    'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0',
                    isActive ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  )}>
                    {isActive && <span className="text-white text-[9px] font-bold">✓</span>}
                  </span>
                  {m.profile?.avatar_url ? (
                    <img src={m.profile.avatar_url} className="h-5 w-5 rounded-full object-cover shrink-0" alt="" />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                      <span className="text-[8px] font-bold text-white">{initials}</span>
                    </div>
                  )}
                  <span className="truncate">{m.profile?.full_name ?? m.user_id}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
