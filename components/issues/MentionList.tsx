'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { ProjectMemberPreview } from '@/services/projects.service'

export interface MentionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

interface MentionListProps {
  items: ProjectMemberPreview[]
  command: (attrs: { id: string; label: string }) => void
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => setSelectedIndex(0), [items])

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  function selectItem(index: number) {
    const item = items[index]
    if (item) {
      command({ id: item.user_id, label: item.profile?.full_name ?? item.user_id })
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs text-gray-400 min-w-[160px]">
        No members found
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[180px] max-w-[240px]">
      {items.map((item, index) => {
        const name = item.profile?.full_name ?? 'Unknown'
        const initials = name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
        return (
          <button
            key={item.user_id}
            onClick={() => selectItem(index)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
              index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {item.profile?.avatar_url ? (
              <img src={item.profile.avatar_url} className="h-6 w-6 rounded-full object-cover shrink-0" alt="" />
            ) : (
              <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-white">{initials}</span>
              </div>
            )}
            <span className="truncate">{name}</span>
          </button>
        )
      })}
    </div>
  )
})

MentionList.displayName = 'MentionList'
export { MentionList }
