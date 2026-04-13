'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'

interface Profile {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  created_at: string
}

interface TeamClientProps {
  profiles: Profile[]
}

export function TeamClient({ profiles }: TeamClientProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter(
      (p) =>
        (p.full_name ?? '').toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
    )
  }, [profiles, search])

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-gray-400 bg-white"
        />
      </div>

      {/* Count */}
      <p className="text-sm text-gray-500 font-medium">{filtered.length} {filtered.length === 1 ? 'person' : 'people'}</p>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((profile) => (
          <PersonCard key={profile.id} profile={profile} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-gray-400 italic py-8 text-center">No people found.</p>
      )}
    </div>
  )
}

function PersonCard({ profile }: { profile: Profile }) {
  const initials = profile.full_name
    ? profile.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : profile.email[0]?.toUpperCase() ?? '?'

  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
  ]
  const color = colors[profile.id.charCodeAt(0) % colors.length]

  return (
    <div className="flex items-stretch bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all overflow-hidden min-h-[80px]">
      {/* Avatar */}
      <div className="shrink-0 w-20">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name ?? profile.email}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className={`h-full w-full ${color} flex items-center justify-center`}>
            <span className="text-lg font-bold text-white">{initials}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 px-3 py-3 flex flex-col justify-center">
        <p className="text-sm font-medium text-gray-900 truncate">
          {profile.full_name ?? profile.email}
        </p>
        {profile.full_name && (
          <p className="text-xs text-gray-400 truncate">{profile.email}</p>
        )}
      </div>
    </div>
  )
}
