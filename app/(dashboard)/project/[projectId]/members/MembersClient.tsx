'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Crown, Shield, User, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/providers/ToastProvider'
import { cn } from '@/lib/utils/cn'
import type { ProjectMemberWithProfile, MemberRole } from '@/types/member.types'
import { inviteMemberAction, updateMemberRoleAction, removeMemberAction } from '../member-actions'

const ROLE_CONFIG: Record<MemberRole, { label: string; icon: React.ReactNode; className: string }> = {
  owner: { label: 'Owner', icon: <Crown size={12} />, className: 'text-yellow-600 bg-yellow-50' },
  admin: { label: 'Admin', icon: <Shield size={12} />, className: 'text-blue-600 bg-blue-50' },
  member: { label: 'Member', icon: <User size={12} />, className: 'text-gray-600 bg-gray-100' },
}

interface MembersClientProps {
  projectId: string
  currentUserId: string
  currentUserRole: MemberRole
  members: ProjectMemberWithProfile[]
}

export function MembersClient({ projectId, currentUserId, currentUserRole, members }: MembersClientProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('member')
  const [inviteLoading, setInviteLoading] = useState(false)

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setInviteLoading(true)

    const { error } = await inviteMemberAction(projectId, email.trim(), inviteRole)
    if (error) {
      toast(error, 'error')
    } else {
      toast('Member added successfully.', 'success')
      setEmail('')
      router.refresh()
    }
    setInviteLoading(false)
  }

  async function handleRoleChange(memberId: string, role: MemberRole) {
    const { error } = await updateMemberRoleAction(projectId, memberId, role)
    if (error) {
      toast(error, 'error')
    } else {
      toast('Role updated.', 'success')
      router.refresh()
    }
  }

  async function handleRemove(memberId: string, name: string) {
    const { error } = await removeMemberAction(projectId, memberId)
    if (error) {
      toast(error, 'error')
    } else {
      toast(`${name} removed from project.`, 'success')
      router.refresh()
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Invite form */}
      {canManage && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UserPlus size={15} />
            Add member
          </h2>
          <form onSubmit={handleInvite} className="flex gap-3 flex-wrap">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address..."
              className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder:text-gray-400"
              required
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MemberRole)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button type="submit" loading={inviteLoading}>
              Add
            </Button>
          </form>
        </div>
      )}

      {/* Members list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">
            Members <span className="text-gray-400 font-normal">({members.length})</span>
          </h2>
        </div>

        <ul className="divide-y divide-gray-50">
          {members.map((member) => {
            const roleConfig = ROLE_CONFIG[member.role]
            const isCurrentUser = member.user_id === currentUserId
            const isOwner = member.role === 'owner'
            const canEdit = canManage && !isOwner && !isCurrentUser

            return (
              <li key={member.id} className="flex items-center gap-3 px-5 py-3">
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                  {member.profile.avatar_url ? (
                    <img src={member.profile.avatar_url} className="h-8 w-8 rounded-full object-cover" alt="" />
                  ) : (
                    <span className="text-xs font-bold text-white">
                      {(member.profile.full_name ?? member.profile.email)[0]?.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.profile.full_name ?? member.profile.email}
                    {isCurrentUser && <span className="text-gray-400 font-normal ml-1">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{member.profile.email}</p>
                </div>

                {/* Role */}
                {canEdit ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as MemberRole)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', roleConfig.className)}>
                    {roleConfig.icon}
                    {roleConfig.label}
                  </span>
                )}

                {/* Remove */}
                {canEdit && (
                  <button
                    onClick={() => handleRemove(member.id, member.profile.full_name ?? member.profile.email)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                    title="Remove member"
                  >
                    <X size={15} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
