'use client'

import { useState, Fragment } from 'react'
import Link from 'next/link'
import { Users, FileText, Trash2, MoreHorizontal, Settings as SettingsIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { AdminUser, PlatformInvitation, AdminProject } from '@/services/admin.service'
import {
  suspendUserAction,
  reactivateUserAction,
  invitePlatformUserAction,
  cancelPlatformInvitationAction,
  deleteProjectAdminAction,
} from './admin-actions'

interface Props {
  active: AdminUser[]
  suspended: AdminUser[]
  invitations: PlatformInvitation[]
  projects: AdminProject[]
  currentUserId: string
}

type Tab = 'users' | 'invitations' | 'projects'

export function AdminClient({ active, suspended, invitations, projects, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>('users')
  const [loading, setLoading] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  async function handle(key: string, fn: () => Promise<{ error: string | null }>) {
    setLoading(key)
    await fn()
    setLoading(null)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteLoading(true)
    const result = await invitePlatformUserAction(inviteEmail.trim())
    if (result.error) {
      setInviteError(result.error)
    } else {
      setInviteEmail('')
    }
    setInviteLoading(false)
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'users', label: 'Users', count: active.length + suspended.length },
    { id: 'invitations', label: 'Invitations', count: invitations.length },
    { id: 'projects', label: 'Projects', count: projects.length },
  ]

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={cn(
                'ml-1.5 px-1.5 py-0.5 text-xs rounded-full',
                tab === t.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          {active.length > 0 && (
            <Section title="Active users">
              {active.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  loading={loading}
                  isSelf={u.id === currentUserId}
                  actions={[
                    {
                      label: 'Suspend',
                      loadingKey: `suspend-${u.id}`,
                      className: 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100',
                      onClick: () => handle(`suspend-${u.id}`, () => suspendUserAction(u.id)),
                    },
                  ]}
                />
              ))}
            </Section>
          )}

          {suspended.length > 0 && (
            <Section title="Suspended users">
              {suspended.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  loading={loading}
                  actions={[
                    {
                      label: 'Reactivate',
                      loadingKey: `reactivate-${u.id}`,
                      className: 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100',
                      onClick: () => handle(`reactivate-${u.id}`, () => reactivateUserAction(u.id)),
                    },
                  ]}
                />
              ))}
            </Section>
          )}

          {active.length === 0 && suspended.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-10">No users found.</p>
          )}
        </div>
      )}

      {/* Projects tab */}
      {tab === 'projects' && (
        <div>
          {projects.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">No projects found.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Project</th>
                    <th className="px-4 py-3 text-left">Owner</th>
                    <th className="px-4 py-3 text-center">Members</th>
                    <th className="px-4 py-3 text-center">Issues</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {projects.map((p, idx) => (
                    <Fragment key={p.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/project/${p.id}/list`} className="block hover:opacity-80 transition-opacity">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{p.key}</span>
                            <span className="font-medium text-gray-900 truncate max-w-[180px] hover:text-blue-600">{p.name}</span>
                          </div>
                          {p.description && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[240px]">{p.description}</p>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {p.owner ? (
                          <div className="flex items-center gap-2">
                            {(() => {
                              const ownerInactive = p.owner.status !== 'active'
                              return p.owner.avatar_url
                                ? <img src={p.owner.avatar_url} className={`h-6 w-6 rounded-full object-cover shrink-0 ${ownerInactive ? 'grayscale opacity-60' : ''}`} alt="" />
                                : <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${ownerInactive ? 'bg-gray-400' : 'bg-blue-500'}`}>
                                    <span className="text-[9px] font-bold text-white">
                                      {(p.owner.full_name ?? p.owner.email)[0]?.toUpperCase()}
                                    </span>
                                  </div>
                            })()}
                            <div className="min-w-0">
                              <p className={`text-xs font-medium truncate ${p.owner.status !== 'active' ? 'text-gray-400' : 'text-gray-900'}`}>{p.owner.full_name ?? '—'}</p>
                              <p className="text-[11px] text-gray-400 truncate">{p.owner.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <Users size={12} className="text-gray-400" />
                          {p.member_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <FileText size={12} className="text-gray-400" />
                          {p.issue_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right w-10 relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors rounded"
                          title="Actions"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {openMenu === p.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                            <div className={`absolute right-2 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-36 ${idx >= projects.length - 2 ? 'bottom-10' : 'top-10'}`}>
                              <Link
                                href={`/project/${p.id}/settings`}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                                onClick={() => setOpenMenu(null)}
                              >
                                <SettingsIcon size={12} />
                                Settings
                              </Link>
                              <button
                                onClick={() => { setOpenMenu(null); setConfirmDelete(p.id) }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 text-left"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                    {confirmDelete === p.id && (
                      <tr key={`confirm-${p.id}`} className="bg-red-50">
                        <td colSpan={6} className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-red-700 font-medium">
                              Delete <strong>{p.name}</strong>? This will permanently remove all issues, comments and members.
                            </span>
                            <button
                              disabled={!!loading}
                              onClick={async () => {
                                setLoading(`del-${p.id}`)
                                await deleteProjectAdminAction(p.id)
                                setLoading(null)
                                setConfirmDelete(null)
                              }}
                              className="shrink-0 px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {loading === `del-${p.id}` ? 'Deleting...' : 'Yes, delete'}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="shrink-0 px-3 py-1 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invitations tab */}
      {tab === 'invitations' && (
        <div className="space-y-5">
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@company.com"
              required
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={inviteLoading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {inviteLoading ? 'Sending...' : 'Invite'}
            </button>
          </form>
          {inviteError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{inviteError}</p>
          )}

          {invitations.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No pending platform invitations.</p>
          ) : (
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                    <p className="text-xs text-gray-400">
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    disabled={!!loading}
                    onClick={() => handle(`cancel-inv-${inv.id}`, () => cancelPlatformInvitationAction(inv.id))}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {loading === `cancel-inv-${inv.id}` ? '...' : 'Cancel'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function UserRow({
  user,
  loading,
  actions,
  isSelf = false,
}: {
  user: AdminUser
  loading: string | null
  isSelf?: boolean
  actions: Array<{
    label: string
    loadingKey: string
    className: string
    onClick: () => void
  }>
}) {
  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{user.full_name ?? '—'}</p>
          {isSelf && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">you</span>
          )}
        </div>
        <p className="text-xs text-gray-500">{user.email}</p>
      </div>
      {!isSelf && (
        <div className="flex gap-2">
          {actions.map((action) => (
            <button
              key={action.loadingKey}
              disabled={!!loading}
              onClick={action.onClick}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors',
                action.className
              )}
            >
              {loading === action.loadingKey ? '...' : action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
