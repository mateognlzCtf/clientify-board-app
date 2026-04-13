'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Plus, Search, Ticket, X, ChevronDown, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { IssueForm } from '@/components/issues/IssueForm'
import { IssueDetail } from '@/components/issues/IssueDetail'
import { StatusBadge, ALL_STATUSES, statusLabel } from '@/components/issues/StatusBadge'
import { PriorityIcon, ALL_PRIORITIES, priorityLabel } from '@/components/issues/PriorityIcon'
import { TypeIcon, ALL_TYPES, typeLabel } from '@/components/issues/TypeIcon'
import { useToast } from '@/providers/ToastProvider'
import { cn } from '@/lib/utils/cn'
import { formatDate, isOverdue } from '@/lib/utils/dates'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { useRealtimeRefresh } from '@/lib/hooks/useRealtimeRefresh'
import type { IssueWithDetails, IssueCreate, IssueUpdate, IssueStatus, IssuePriority, IssueType } from '@/types/issue.types'
import type { ProjectMemberPreview } from '@/services/projects.service'
import type { Sprint } from '@/types/sprint.types'
import type { Epic } from '@/types/epic.types'
import {
  createIssueAction,
  updateIssueAction,
  deleteIssueAction,
} from '../actions'

interface ActiveFilters {
  statuses: string[]
  priorities: string[]
  types: string[]
  assigneeId: string
}

interface IssuesClientProps {
  projectId: string
  currentUserId: string
  canDelete: boolean
  issues: IssueWithDetails[]
  sprints: Sprint[]
  members: ProjectMemberPreview[]
  epics: Epic[]
  initialFilters: ActiveFilters
}

export function IssuesClient({ projectId, currentUserId, canDelete, issues, sprints, members, epics, initialFilters }: IssuesClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  useRefreshOnFocus(() => setDetailTarget(null))
  useRealtimeRefresh(projectId)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<ActiveFilters>(initialFilters)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState<IssueWithDetails | null>(null)
  useEffect(() => {
    if (!detailTarget) return
    const fresh = issues.find((i) => i.id === detailTarget.id)
    if (fresh) setDetailTarget(fresh)
  }, [issues])
  const [editTarget, setEditTarget] = useState<IssueWithDetails | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IssueWithDetails | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Update URL params when filters change
  const applyFilters = useCallback((next: ActiveFilters) => {
    setFilters(next)
    const params = new URLSearchParams(searchParams.toString())

    if (next.statuses.length) params.set('status', next.statuses.join(','))
    else params.delete('status')

    if (next.priorities.length) params.set('priority', next.priorities.join(','))
    else params.delete('priority')

    if (next.types.length) params.set('type', next.types.join(','))
    else params.delete('type')

    if (next.assigneeId) params.set('assignee', next.assigneeId)
    else params.delete('assignee')

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams])

  const hasActiveFilters = filters.statuses.length > 0 || filters.priorities.length > 0 ||
    filters.types.length > 0 || !!filters.assigneeId

  const filtered = useMemo(() => {
    return issues.filter((i) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        if (!i.title.toLowerCase().includes(q) && !i.key.toLowerCase().includes(q)) return false
      }
      if (filters.statuses.length && !filters.statuses.includes(i.status)) return false
      if (filters.priorities.length && !filters.priorities.includes(i.priority)) return false
      if (filters.types.length && !filters.types.includes(i.type)) return false
      if (filters.assigneeId) {
        if (filters.assigneeId === 'unassigned' && i.assignee_id) return false
        if (filters.assigneeId !== 'unassigned' && i.assignee_id !== filters.assigneeId) return false
      }
      return true
    })
  }, [issues, search, filters])

  async function handleCreate(data: IssueCreate) {
    try {
      const { error } = await createIssueAction(projectId, data)
      if (error) { toast(error, 'error'); return }
      toast('Ticket created.', 'success')
      setCreateOpen(false)
      router.refresh()
    } catch {
      toast('Unexpected error creating ticket.', 'error')
    }
  }

  async function handleEdit(data: IssueUpdate) {
    if (!editTarget) return
    try {
      const { error } = await updateIssueAction(projectId, editTarget.id, data)
      if (error) { toast(error, 'error'); return }
      toast('Ticket updated.', 'success')
      setEditTarget(null)
      router.refresh()
    } catch {
      toast('Unexpected error updating ticket.', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const { error } = await deleteIssueAction(projectId, deleteTarget.id)
      if (error) { toast(error, 'error'); return }
      toast('Ticket deleted.', 'success')
      setDeleteTarget(null)
      setDetailTarget(null)
      router.refresh()
    } catch {
      toast('Unexpected error deleting ticket.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  function openEdit(issue: IssueWithDetails) {
    setDetailTarget(null)
    setEditTarget(issue)
  }

  function openDelete(issue: IssueWithDetails) {
    setDetailTarget(null)
    setDeleteTarget(issue)
  }

  function clearFilters() {
    applyFilters({ statuses: [], priorities: [], types: [], assigneeId: '' })
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-400"
          />
        </div>

        {/* Filter dropdowns */}
        <FilterDropdown
          label="Status"
          options={ALL_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
          selected={filters.statuses}
          onChange={(v) => applyFilters({ ...filters, statuses: v })}
        />
        <FilterDropdown
          label="Priority"
          options={ALL_PRIORITIES.map((p) => ({ value: p, label: priorityLabel(p) }))}
          selected={filters.priorities}
          onChange={(v) => applyFilters({ ...filters, priorities: v })}
        />
        <FilterDropdown
          label="Type"
          options={ALL_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))}
          selected={filters.types}
          onChange={(v) => applyFilters({ ...filters, types: v })}
        />

        {/* Assignee filter */}
        <select
          value={filters.assigneeId}
          onChange={(e) => applyFilters({ ...filters, assigneeId: e.target.value })}
          className={cn(
            'px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
            filters.assigneeId ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600'
          )}
        >
          <option value="">Assignee</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.profile?.full_name ?? m.user_id}
            </option>
          ))}
        </select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            <X size={12} />
            Clear
          </button>
        )}

        <div className="ml-auto">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={15} />
            New ticket
          </Button>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {filters.statuses.map((s) => (
            <FilterChip key={s} label={statusLabel(s as IssueStatus)} onRemove={() =>
              applyFilters({ ...filters, statuses: filters.statuses.filter((x) => x !== s) })} />
          ))}
          {filters.priorities.map((p) => (
            <FilterChip key={p} label={priorityLabel(p as IssuePriority)} onRemove={() =>
              applyFilters({ ...filters, priorities: filters.priorities.filter((x) => x !== p) })} />
          ))}
          {filters.types.map((t) => (
            <FilterChip key={t} label={typeLabel(t as IssueType)} onRemove={() =>
              applyFilters({ ...filters, types: filters.types.filter((x) => x !== t) })} />
          ))}
          {filters.assigneeId && (
            <FilterChip
              label={filters.assigneeId === 'unassigned' ? 'Unassigned' :
                (members.find((m) => m.user_id === filters.assigneeId)?.profile?.full_name ?? 'Assignee')}
              onRemove={() => applyFilters({ ...filters, assigneeId: '' })}
            />
          )}
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Key</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[200px]">Summary</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Parent</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Comments</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Sprint</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Assignee</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Due date</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Priority</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Created</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Updated</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Reporter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((issue) => {
                const sprint = sprints.find((s) => s.id === issue.sprint_id)
                return (
                  <tr key={issue.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><TypeIcon type={issue.type} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{issue.key}</td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <button
                        onClick={() => setDetailTarget(issue)}
                        className="text-left text-gray-900 hover:text-blue-600 font-medium transition-colors truncate block w-full"
                      >
                        {issue.title}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {issue.epic ? (
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full truncate max-w-[130px] block"
                          style={{ backgroundColor: issue.epic.color + '22', color: issue.epic.color }}
                        >
                          {issue.epic.name}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={issue.status} /></td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetailTarget(issue)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <MessageSquare size={13} />
                        <span>
                          {issue.comment_count > 0
                            ? `${issue.comment_count} comment${issue.comment_count === 1 ? '' : 's'}`
                            : 'Add comment'}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {sprint ? (
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs truncate max-w-[120px] block">
                          {sprint.name}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><UserCell person={issue.assignee} fallback="Unassigned" /></td>
                    <td className="px-4 py-3">
                      {issue.due_date ? (
                        <span className={cn('text-xs', isOverdue(issue.due_date) ? 'text-red-500 font-medium' : 'text-gray-600')}>
                          {formatDate(issue.due_date)}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><PriorityIcon priority={issue.priority} showLabel /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(issue.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(issue.updated_at)}</td>
                    <td className="px-4 py-3"><UserCell person={issue.reporter} fallback="Unknown" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : issues.length === 0 ? (
        <EmptyState
          icon={<Ticket size={48} />}
          title="No tickets yet"
          description="Create the first ticket to start tracking work on this project."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={15} />
              Create first ticket
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={<Search size={40} />}
          title="No results"
          description="No tickets match the current filters."
        />
      )}

      {/* Modal: ticket detail */}
      <Modal open={detailTarget !== null} onClose={() => setDetailTarget(null)} title={detailTarget?.key ?? ''} size="2xl" externalHref={detailTarget ? `/project/${projectId}/issue/${detailTarget.id}` : undefined}>
        {detailTarget && (
          <IssueDetail
            issue={detailTarget}
            currentUserId={currentUserId}
            projectId={projectId}
            members={members}
            sprints={sprints}
            epics={epics}
            canDelete={canDelete}
            onEdit={() => openEdit(detailTarget)}
            onDelete={() => openDelete(detailTarget)}
            onUpdated={(patch) => {
              setDetailTarget((prev) => prev ? { ...prev, ...patch } : prev)
              router.refresh()
            }}
          />
        )}
      </Modal>

      {/* Modal: create */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New ticket" size="xl">
        <IssueForm mode="create" projectId={projectId} members={members} sprints={sprints} epics={epics} defaultSprintId={sprints.find((s) => s.status === 'active')?.id ?? null} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
      </Modal>

      {/* Modal: edit */}
      <Modal open={editTarget !== null} onClose={() => setEditTarget(null)} title="Edit ticket" size="xl">
        {editTarget && (
          <IssueForm mode="edit" issue={editTarget} members={members} sprints={sprints} epics={epics} onSubmit={handleEdit} onCancel={() => setEditTarget(null)} />
        )}
      </Modal>

      {/* Confirm delete */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete ticket"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Yes, delete"
      />
    </>
  )
}

// ── Filter dropdown ──────────────────────────────────────────────────────────

function FilterDropdown({
  label, options, selected, onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const active = selected.length > 0

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors',
          active
            ? 'border-blue-400 bg-blue-50 text-blue-700'
            : 'border-gray-300 text-gray-600 hover:border-gray-400'
        )}
      >
        {label}
        {active && <span className="font-semibold">({selected.length})</span>}
        <ChevronDown size={13} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-20 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[140px]">
            {options.map(({ value, label: optLabel }) => {
              const checked = selected.includes(value)
              return (
                <label key={value} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange(checked ? selected.filter((s) => s !== value) : [...selected, value])}
                    className="rounded"
                  />
                  {optLabel}
                </label>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900"><X size={10} /></button>
    </span>
  )
}

function UserCell({ person, fallback }: { person: { id: string; full_name: string | null; avatar_url: string | null } | null; fallback: string }) {
  if (!person) return <span className="text-xs text-gray-300">{fallback}</span>
  const initials = person.full_name ? person.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() : '?'
  return (
    <div className="flex items-center gap-1.5">
      {person.avatar_url ? (
        <img src={person.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
          <span className="text-[8px] font-bold text-white">{initials}</span>
        </div>
      )}
      <span className="text-xs text-gray-600 truncate max-w-[80px]">{person.full_name ?? 'Unknown'}</span>
    </div>
  )
}
