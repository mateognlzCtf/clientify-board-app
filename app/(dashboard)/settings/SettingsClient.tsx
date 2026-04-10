'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/providers/ToastProvider'
import { updateProfileAction } from './actions'
import type { UserProfile } from '@/types/auth.types'

interface SettingsClientProps {
  profile: UserProfile
}

export function SettingsClient({ profile }: SettingsClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [loading, setLoading] = useState(false)

  const initials = fullName.trim()
    ? fullName.trim().split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : profile.email[0]?.toUpperCase() ?? '?'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await updateProfileAction({ full_name: fullName })
    if (error) {
      toast(error, 'error')
    } else {
      toast('Profile updated.', 'success')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Profile</h1>
      <p className="text-sm text-gray-500 mb-6">Manage your account information.</p>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Avatar preview */}
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Avatar"
              className="h-16 w-16 rounded-full object-cover ring-2 ring-gray-100"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center ring-2 ring-gray-100">
              {initials !== '?' ? (
                <span className="text-white text-xl font-semibold">{initials}</span>
              ) : (
                <User size={24} className="text-white" />
              )}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">{fullName || '—'}</p>
            <p className="text-xs text-gray-400">{profile.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder:text-gray-400"
            />
          </div>

          {/* Email — read only */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email <span className="text-gray-400 font-normal">(cannot be changed)</span>
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 bg-gray-50 cursor-not-allowed"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={loading}>
              Save changes
            </Button>
          </div>
        </form>
      </div>

      {/* Account info */}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Account</h2>
        <div className="text-xs text-gray-400 space-y-1">
          <p>Member since: {new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p>User ID: <span className="font-mono">{profile.id}</span></p>
        </div>
      </div>
    </div>
  )
}
