'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Plus, Search, Ticket, MessageSquare, GripVertical, Layers, ChevronDown, CircleDot, Zap, Users, Flag } from 'lucide-react'
import { JiraFilterButton, type FilterFieldDef } from '@/components/issues/JiraFilterButton'
import { AssigneeAvatars } from '@/components/issues/AssigneeAvatars'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { IssueForm } from '@/components/issues/IssueForm'
import { IssueDetail } from '@/components/issues/IssueDetail'
import { StatusBadge } from '@/components/issues/StatusBadge'
import { PriorityIcon, ALL_PRIORITIES, priorityLabel } from '@/components/issues/PriorityIcon'
import { TypeIcon } from '@/components/issues/TypeIcon'
import { useToast } from '@/providers/ToastProvider'
import { useProjectSettings, formatSettingLabel } from '@/contexts/ProjectSettingsContext'
import { cn } from '@/lib/utils/cn'
import { formatDate, isOverdue } from '@/lib/utils/dates'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { useRealtimeRefresh } from '@/lib/hooks/useRealtimeRefresh'
import type { IssueWithDetails, IssueCreate, IssueUpdate, IssuePriority } from '@/types/issue.types'
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
  assignees: string[]
  labels: string[]
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
  const { statuses: projectStatuses, types: projectTypes, labels: projectLabels } = useProjectSettings()
  useRefreshOnFocus(() => setDetailTarget(null))
  useRealtimeRefresh(projectId)

  const [localIssues, setLocalIssues] = useState<IssueWithDetails[]>(
    [...issues].sort((a, b) => a.position - b.position)
  )
  useEffect(() => {
    setLocalIssues([...issues].sort((a, b) => a.position - b.position))
  }, [issues])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [activeIssue, setActiveIssue] = useState<IssueWithDetails | null>(null)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<ActiveFilters>(initialFilters)
  const [listGroupBy, setListGroupBy] = useState<'none' | 'status' | 'sprint' | 'assignee' | 'priority'>('none')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreateOpen(true)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('new')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }, [searchParams])
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

    if (next.assignees.length) params.set('assignee', next.assignees.join(','))
    else params.delete('assignee')

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams])

  const hasActiveFilters = filters.statuses.length > 0 || filters.priorities.length > 0 ||
    filters.types.length > 0 || filters.assignees.length > 0 || filters.labels.length > 0

  const filtered = useMemo(() => {
    return localIssues.filter((i) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        if (!i.title.toLowerCase().includes(q) && !i.key.toLowerCase().includes(q)) return false
      }
      if (filters.statuses.length && !filters.statuses.includes(i.status)) return false
      if (filters.priorities.length && !filters.priorities.includes(i.priority)) return false
      if (filters.types.length && !filters.types.includes(i.type)) return false
      if (filters.assignees.length > 0 && !filters.assignees.includes(i.assignee_id ?? '__unassigned__')) return false
      if (filters.labels.length && !filters.labels.some((id) => i.labels?.some((l) => l.id === id))) return false
      return true
    })
  }, [localIssues, search, filters])

  const groupedIssues = useMemo(() => {
    if (listGroupBy === 'none') return null
    const map = new Map<string, { key: string; label: string; issues: IssueWithDetails[] }>()
    for (const issue of filtered) {
      let key: string, label: string
      if (listGroupBy === 'status') {
        key = issue.status; label = formatSettingLabel(issue.status)
      } else if (listGroupBy === 'sprint') {
        key = issue.sprint_id ?? '__none__'
        label = sprints.find((s) => s.id === issue.sprint_id)?.name ?? 'Backlog'
      } else if (listGroupBy === 'assignee') {
        key = issue.assignee_id ?? '__unassigned__'
        label = issue.assignee?.full_name ?? 'Unassigned'
      } else {
        key = issue.priority; label = priorityLabel(issue.priority)
      }
      if (!map.has(key)) map.set(key, { key, label, issues: [] })
      map.get(key)!.issues.push(issue)
    }
    const groups = Array.from(map.values())
    if (listGroupBy === 'sprint') {
      groups.sort((a, b) => a.key === '__none__' ? 1 : b.key === '__none__' ? -1 : 0)
    }
    return groups
  }, [filtered, listGroupBy, sprints])

  function handleDragStart({ active }: DragStartEvent) {
    setActiveIssue(localIssues.find((i) => i.id === active.id) ?? null)
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveIssue(null)
    if (!over || active.id === over.id) return
    const oldIndex = filtered.findIndex((i) => i.id === active.id)
    const newIndex = filtered.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(filtered, oldIndex, newIndex)
    const filteredIds = new Set(filtered.map((i) => i.id))
    const rest = localIssues.filter((i) => !filteredIds.has(i.id))
    setLocalIssues([...reordered, ...rest])
    await Promise.all(
      reordered.map((issue, idx) => updateIssueAction(projectId, issue.id, { position: idx }))
    )
  }

  async function handleGroupedDragEnd({ active, over }: DragEndEvent) {
    setActiveIssue(null)
    if (!over || active.id === over.id || !groupedIssues) return
    const sourceGroup = groupedIssues.find((g) => g.issues.some((i) => i.id === active.id))
    const targetGroup = groupedIssues.find((g) => g.issues.some((i) => i.id === over.id))
    if (!sourceGroup || !targetGroup) return

    if (sourceGroup.key === targetGroup.key) {
      // Reorder within same group
      const oldIndex = sourceGroup.issues.findIndex((i) => i.id === active.id)
      const newIndex = targetGroup.issues.findIndex((i) => i.id === over.id)
      const reordered = arrayMove(sourceGroup.issues, oldIndex, newIndex)
      setLocalIssues((prev) => {
        const groupIds = new Set(sourceGroup.issues.map((i) => i.id))
        const rest = prev.filter((i) => !groupIds.has(i.id))
        return [...rest, ...reordered]
      })
      await Promise.all(reordered.map((issue, idx) => updateIssueAction(projectId, issue.id, { position: idx })))
    } else {
      // Move to different group — update the grouped field
      const patch: IssueUpdate = {}
      if (listGroupBy === 'status') {
        const targetStatus = projectStatuses.find((s) => s.name === targetGroup.key)
        if (targetStatus?.requires_pause_reason) {
          toast('Open the ticket and fill in Pause reason before moving to this status.', 'error')
          return
        }
        patch.status = targetGroup.key as IssueWithDetails['status']
      } else if (listGroupBy === 'sprint') {
        patch.sprint_id = targetGroup.key === '__none__' ? null : targetGroup.key
      } else if (listGroupBy === 'assignee') {
        patch.assignee_id = targetGroup.key === '__unassigned__' ? null : targetGroup.key
      } else if (listGroupBy === 'priority') {
        patch.priority = targetGroup.key as IssueWithDetails['priority']
      }
      setLocalIssues((prev) => prev.map((i) => i.id === active.id ? { ...i, ...patch } : i))
      const { error } = await updateIssueAction(projectId, active.id as string, patch)
      if (error) { toast(error, 'error'); router.refresh() }
    }
  }

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
    applyFilters({ statuses: [], priorities: [], types: [], assignees: [], labels: [] })
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

        {/* Assignee bubbles */}
        {members.length > 0 && (
          <AssigneeAvatars
            members={members}
            activeIds={filters.assignees}
            onToggle={(userId) =>
              applyFilters({
                ...filters,
                assignees: filters.assignees.includes(userId)
                  ? filters.assignees.filter((id) => id !== userId)
                  : [...filters.assignees, userId],
              })
            }
          />
        )}

        {/* Filter button */}
        <JiraFilterButton
          fields={[
            {
              id: 'statuses', label: 'Status',
              options: projectStatuses.map((s) => ({ value: s.name, label: formatSettingLabel(s.name) })),
            },
            {
              id: 'priorities', label: 'Priority',
              options: ALL_PRIORITIES.map((p) => ({ value: p, label: priorityLabel(p) })),
            },
            {
              id: 'types', label: 'Type',
              options: projectTypes.map((t) => ({ value: t.name, label: formatSettingLabel(t.name) })),
            },
            {
              id: 'assignees', label: 'Assignee',
              options: [
                { value: '__unassigned__', label: 'Unassigned' },
                ...members.map((m) => ({ value: m.user_id, label: m.profile?.full_name ?? m.user_id, avatarUrl: m.profile?.avatar_url ?? null })),
              ],
            },
            ...(projectLabels.length > 0 ? [{
              id: 'labels', label: 'Labels',
              options: projectLabels.map((l) => ({ value: l.id, label: l.name, color: l.color })),
            } satisfies FilterFieldDef] : []),
          ]}
          values={filters as unknown as Record<string, string[]>}
          onChange={(v) => applyFilters({ statuses: v.statuses ?? [], priorities: v.priorities ?? [], types: v.types ?? [], assignees: v.assignees ?? [], labels: v.labels ?? [] })}
        />

        {/* Group button */}
        <ListGroupButton groupBy={listGroupBy} onChange={setListGroupBy} />
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {filters.statuses.map((s) => (
            <FilterChip key={s} label={formatSettingLabel(s)} onRemove={() =>
              applyFilters({ ...filters, statuses: filters.statuses.filter((x) => x !== s) })} />
          ))}
          {filters.priorities.map((p) => (
            <FilterChip key={p} label={priorityLabel(p as IssuePriority)} onRemove={() =>
              applyFilters({ ...filters, priorities: filters.priorities.filter((x) => x !== p) })} />
          ))}
          {filters.types.map((t) => (
            <FilterChip key={t} label={formatSettingLabel(t)} onRemove={() =>
              applyFilters({ ...filters, types: filters.types.filter((x) => x !== t) })} />
          ))}
          {filters.assignees.map((a) => (
            <FilterChip
              key={a}
              label={a === '__unassigned__' ? 'Unassigned' : (members.find((m) => m.user_id === a)?.profile?.full_name ?? a)}
              onRemove={() => applyFilters({ ...filters, assignees: filters.assignees.filter((x) => x !== a) })}
            />
          ))}
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        listGroupBy !== 'none' && groupedIssues ? (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleGroupedDragEnd}>
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="w-8 px-2" />
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Type</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Key</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[200px]">Summary</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Parent</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Labels</th>
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
                  {groupedIssues.map((group) => {
                    const collapsed = collapsedGroups.has(group.key)
                    return (
                      <SortableContext key={group.key} items={group.issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        <>
                          <tr className="bg-gray-50 border-y border-gray-100">
                            <td colSpan={15} className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setCollapsedGroups((prev) => {
                                    const next = new Set(prev)
                                    if (next.has(group.key)) next.delete(group.key)
                                    else next.add(group.key)
                                    return next
                                  })}
                                  className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  <ChevronDown size={14} className={cn('transition-transform', collapsed && '-rotate-90')} />
                                </button>
                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  {group.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setCreateOpen(true)}
                                  className="ml-1 flex items-center justify-center h-4 w-4 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                  title="Create ticket"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {!collapsed && group.issues.map((issue) => (
                            <SortableIssueRow
                              key={issue.id}
                              issue={issue}
                              sprints={sprints}
                              onDetail={() => setDetailTarget(issue)}
                            />
                          ))}
                        </>
                      </SortableContext>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <DragOverlay dropAnimation={null}>
              {activeIssue && (
                <div className="bg-white border border-blue-300 rounded-lg shadow-xl px-4 py-2 text-sm font-medium text-gray-800 opacity-95">
                  {activeIssue.key} — {activeIssue.title}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="w-8 px-2" />
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Type</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Key</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[200px]">Summary</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Parent</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Labels</th>
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
                  {filtered.map((issue) => (
                    <SortableIssueRow
                      key={issue.id}
                      issue={issue}
                      sprints={sprints}
                      onDetail={() => setDetailTarget(issue)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeIssue && (
              <div className="bg-white border border-blue-300 rounded-lg shadow-xl px-4 py-2 text-sm font-medium text-gray-800 opacity-95">
                {activeIssue.key} — {activeIssue.title}
              </div>
            )}
          </DragOverlay>
        </DndContext>
        )
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
              const resolved = patch.label_ids !== undefined
                ? { ...patch, labels: projectLabels.filter((l) => patch.label_ids!.includes(l.id)) }
                : patch
              setDetailTarget((prev) => prev ? { ...prev, ...resolved } : prev)
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

// ── Sortable row ─────────────────────────────────────────────────────────────

function SortableIssueRow({
  issue, sprints, onDetail, disableDrag,
}: {
  issue: IssueWithDetails
  sprints: Sprint[]
  onDetail: () => void
  disableDrag?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id, disabled: disableDrag })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const sprint = sprints.find((s) => s.id === issue.sprint_id)

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn('hover:bg-gray-50 transition-colors', isDragging && 'opacity-40 bg-blue-50')}
    >
      <td className="px-2 py-3 w-8">
        {disableDrag ? (
          <span className="w-5 h-5 block" />
        ) : (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-0.5 rounded"
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>
        )}
      </td>
      <td className="px-4 py-3"><TypeIcon type={issue.type} /></td>
      <td className="px-4 py-3 font-mono text-xs text-gray-400">{issue.key}</td>
      <td className="px-4 py-3 max-w-[260px]">
        <button
          onClick={onDetail}
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
      <td className="px-4 py-3">
        {issue.labels?.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {issue.labels.map((l) => (
              <span
                key={l.id}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: l.color + '22', color: l.color }}
              >
                {l.name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3"><StatusBadge status={issue.status} /></td>
      <td className="px-4 py-3">
        <button
          onClick={onDetail}
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
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 ml-0.5">×</button>
    </span>
  )
}

// ── List Group Button ─────────────────────────────────────────────────────────

type ListGroupBy = 'none' | 'status' | 'sprint' | 'assignee' | 'priority'

const GROUP_OPTIONS: { value: ListGroupBy; label: string; icon: React.ReactNode }[] = [
  { value: 'none', label: 'None', icon: <Layers size={14} /> },
  { value: 'status', label: 'Status', icon: <CircleDot size={14} /> },
  { value: 'sprint', label: 'Sprint', icon: <Zap size={14} /> },
  { value: 'assignee', label: 'Assignee', icon: <Users size={14} /> },
  { value: 'priority', label: 'Priority', icon: <Flag size={14} /> },
]

function ListGroupButton({ groupBy, onChange }: { groupBy: ListGroupBy; onChange: (v: ListGroupBy) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const active = GROUP_OPTIONS.find((o) => o.value === groupBy)!

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
          groupBy !== 'none'
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'border-gray-300 text-gray-600 bg-white hover:bg-gray-50'
        )}
      >
        <Layers size={14} />
        Group
        {groupBy !== 'none' && <span className="text-blue-500">: {active.label}</span>}
        <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-gray-200 shadow-xl w-44 py-1.5">
          <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Group by</p>
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors',
                groupBy === opt.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <span className={cn(groupBy === opt.value ? 'text-blue-500' : 'text-gray-400')}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
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
