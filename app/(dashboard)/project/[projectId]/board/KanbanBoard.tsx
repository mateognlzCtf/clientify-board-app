'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SlidersHorizontal, X, ChevronRight, ChevronDown, Search, Plus, Layers, Pencil, Check } from 'lucide-react'
import { AssigneeAvatars } from '@/components/issues/AssigneeAvatars'
import { cn } from '@/lib/utils/cn'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IssueForm } from '@/components/issues/IssueForm'
import { PriorityIcon, ALL_PRIORITIES, priorityLabel } from '@/components/issues/PriorityIcon'
import { TypeIcon } from '@/components/issues/TypeIcon'
import { StatusBadge } from '@/components/issues/StatusBadge'
import { useToast } from '@/providers/ToastProvider'
import { useProjectSettings, formatSettingLabel } from '@/contexts/ProjectSettingsContext'
import { useProjectData } from '@/contexts/ProjectDataContext'
import type { ProjectStatus, ProjectIssueType as ProjectType, ProjectLabel as ProjectLabelType } from '@/types/project-settings.types'
import type { IssueWithDetails, IssueUpdate } from '@/types/issue.types'
import type { ProjectMemberPreview } from '@/services/projects.service'
import type { Sprint } from '@/types/sprint.types'
import type { Epic } from '@/types/epic.types'
import { updateIssueAction, deleteIssueAction, createIssueAction } from '../actions'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { useRealtimeRefresh } from '@/lib/hooks/useRealtimeRefresh'


interface KanbanBoardProps {
  projectId: string
  currentUserId: string
  canDelete: boolean
  issues: IssueWithDetails[]
}

interface BoardFilters {
  sprints: string[]
  assignees: string[]
  labels: string[]
  priorities: string[]
  types: string[]
  parents: string[]
}

const EMPTY_FILTERS: BoardFilters = { sprints: [], assignees: [], labels: [], priorities: [], types: [], parents: [] }

type GroupBy = 'none' | 'assignee' | 'epic'

export function KanbanBoard({ projectId, currentUserId, canDelete, issues: initialIssues }: KanbanBoardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { statuses: projectStatuses, types: projectTypes, labels: projectLabels } = useProjectSettings()
  const { sprints, members: rawMembers, epics } = useProjectData()
  const members = useMemo(
    () => [...rawMembers].sort((a, b) =>
      (a.profile?.full_name ?? a.user_id).localeCompare(
        b.profile?.full_name ?? b.user_id,
        undefined,
        { sensitivity: 'base' },
      ),
    ),
    [rawMembers],
  )
  useRefreshOnFocus(() => {})
  useRealtimeRefresh(projectId)

  const [issues, setIssues] = useState<IssueWithDetails[]>(initialIssues)
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS)
  const [searchQuery, setSearchQuery] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const [activeIssue, setActiveIssue] = useState<IssueWithDetails | null>(null)
  const [editTarget, setEditTarget] = useState<IssueWithDetails | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IssueWithDetails | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [createStatus, setCreateStatus] = useState<string | null>(null)

  useEffect(() => { setIssues(initialIssues) }, [initialIssues])

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreateStatus('')
      const params = new URLSearchParams(searchParams.toString())
      params.delete('new')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }, [searchParams])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ── Filtering ───────────────────────────────────────────────────────────────

  const hasFilters = Object.values(filters).some((v) => v.length > 0)

  const boardIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!issue.title.toLowerCase().includes(q) && !issue.key.toLowerCase().includes(q)) return false
      }
      if (filters.sprints.length > 0 && !filters.sprints.includes(issue.sprint_id ?? '__none__')) return false
      if (filters.assignees.length > 0 && !filters.assignees.includes(issue.assignee_id ?? '__unassigned__')) return false
      if (filters.labels.length > 0 && !filters.labels.some((id) => issue.labels?.some((l) => l.id === id))) return false
      if (filters.priorities.length > 0 && !filters.priorities.includes(issue.priority)) return false
      if (filters.types.length > 0 && !filters.types.includes(issue.type)) return false
      if (filters.parents.length > 0 && !filters.parents.includes(issue.epic_id ?? '__none__')) return false
      return true
    })
  }, [issues, filters, searchQuery])

  const issuesByStatus = useMemo(() =>
    projectStatuses.reduce<Record<string, IssueWithDetails[]>>((acc, s) => {
      acc[s.name] = boardIssues.filter((i) => i.status === s.name)
      return acc
    }, {}),
  [projectStatuses, boardIssues])

  // ── Active filter chips ─────────────────────────────────────────────────────

  type FilterChipDef = { key: string; label: string; field: keyof BoardFilters; value: string }

  const activeChips = useMemo<FilterChipDef[]>(() => {
    const chips: FilterChipDef[] = []
    filters.sprints.forEach((v) => {
      const s = v === '__none__' ? { name: 'No sprint' } : sprints.find((sp) => sp.id === v)
      if (s) chips.push({ key: `sprint-${v}`, label: s.name, field: 'sprints', value: v })
    })
    filters.assignees.forEach((v) => {
      const label = v === '__unassigned__' ? 'Unassigned' : (members.find((m) => m.user_id === v)?.profile?.full_name ?? v)
      chips.push({ key: `assignee-${v}`, label, field: 'assignees', value: v })
    })
    filters.labels.forEach((v) => {
      const l = projectLabels.find((lb) => lb.id === v)
      if (l) chips.push({ key: `label-${v}`, label: l.name, field: 'labels', value: v })
    })
    filters.priorities.forEach((v) => {
      chips.push({ key: `priority-${v}`, label: priorityLabel(v as IssueWithDetails['priority']), field: 'priorities', value: v })
    })
    filters.types.forEach((v) => {
      chips.push({ key: `type-${v}`, label: formatSettingLabel(v), field: 'types', value: v })
    })
    filters.parents.forEach((v) => {
      const label = v === '__none__' ? 'No parent' : (epics.find((e) => e.id === v)?.name ?? v)
      chips.push({ key: `parent-${v}`, label, field: 'parents', value: v })
    })
    return chips
  }, [filters, sprints, members, projectLabels, epics])

  function removeChip(field: keyof BoardFilters, value: string) {
    setFilters((prev) => ({ ...prev, [field]: prev[field].filter((v) => v !== value) }))
  }

  // ── Groups (swimlanes) ──────────────────────────────────────────────────────

  const groups = useMemo(() => {
    if (groupBy === 'none') return []
    const seen = new Set<string>()
    const result: { id: string; label: string; color?: string; avatarUrl?: string | null }[] = []

    if (groupBy === 'assignee') {
      if (boardIssues.some((i) => !i.assignee_id))
        result.push({ id: '__unassigned__', label: 'Unassigned' })
      boardIssues.forEach((i) => {
        if (i.assignee_id && !seen.has(i.assignee_id)) {
          seen.add(i.assignee_id)
          result.push({ id: i.assignee_id, label: i.assignee?.full_name ?? i.assignee_id, avatarUrl: i.assignee?.avatar_url ?? null })
        }
      })
    } else {
      if (boardIssues.some((i) => !i.epic_id))
        result.push({ id: '__none__', label: 'No epic' })
      boardIssues.forEach((i) => {
        if (i.epic_id && !seen.has(i.epic_id)) {
          seen.add(i.epic_id)
          result.push({ id: i.epic_id, label: i.epic?.name ?? i.epic_id, color: i.epic?.color })
        }
      })
    }
    return result
  }, [groupBy, boardIssues])

  function getGroupIssues(groupId: string, statusName: string) {
    return boardIssues.filter((i) => {
      if (i.status !== statusName) return false
      if (groupBy === 'assignee') return (i.assignee_id ?? '__unassigned__') === groupId
      return (i.epic_id ?? '__none__') === groupId
    })
  }

  // ── DnD ─────────────────────────────────────────────────────────────────────

  function handleDragStart({ active }: DragStartEvent) {
    const issue = issues.find((i) => i.id === active.id)
    if (issue) setActiveIssue(issue)
  }

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      setActiveIssue(null)
      if (!over) return
      const issue = issues.find((i) => i.id === active.id)
      // droppable IDs in swimlane mode are "groupId||statusName"
      const overId = over.id as string
      const newStatus = overId.includes('||') ? overId.split('||')[1] : overId
      if (!issue || issue.status === newStatus) return

      const targetStatus = projectStatuses.find((s) => s.name === newStatus)
      if (targetStatus?.requires_pause_reason && !issue.pause_reason?.trim()) {
        toast('Open the ticket and fill in Pause reason before moving to this status.', 'error')
        return
      }

      setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, status: newStatus as IssueWithDetails['status'] } : i)))
      const { error } = await updateIssueAction(projectId, issue.id, { status: newStatus as IssueUpdate['status'] })
      if (error) { toast(error, 'error'); setIssues(initialIssues) }
      else router.refresh()
    },
    [issues, projectId, initialIssues, toast, router, projectStatuses]
  )

  // Inline editing from cards: optimistic local update + server persist.
  // Resolves nested objects (assignee, epic, labels) from settings so the
  // card re-renders instantly with the new values.
  const handleInlineUpdate = useCallback(async (issueId: string, patch: IssueUpdate) => {
    setIssues((prev) => prev.map((i) => {
      if (i.id !== issueId) return i
      const updated: IssueWithDetails = { ...i, ...patch } as IssueWithDetails
      if (patch.label_ids !== undefined) {
        updated.labels = patch.label_ids
          .map((id) => projectLabels.find((l) => l.id === id))
          .filter((l): l is typeof projectLabels[number] => !!l)
      }
      if (patch.epic_id !== undefined) {
        updated.epic = patch.epic_id ? (epics.find((e) => e.id === patch.epic_id) ?? null) : null
      }
      if (patch.assignee_id !== undefined) {
        updated.assignee = patch.assignee_id
          ? (rawMembers.find((m) => m.user_id === patch.assignee_id)?.profile ?? null)
          : null
      }
      return updated
    }))
    const { error } = await updateIssueAction(projectId, issueId, patch)
    if (error) {
      toast(error, 'error')
      setIssues(initialIssues)
    }
  }, [projectId, projectLabels, epics, rawMembers, toast, initialIssues])

  async function handleEdit(data: IssueUpdate) {
    if (!editTarget) return
    const { error } = await updateIssueAction(projectId, editTarget.id, data)
    if (error) { toast(error, 'error'); return }
    toast('Ticket updated.', 'success')
    setEditTarget(null)
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const { error } = await deleteIssueAction(projectId, deleteTarget.id)
    if (error) { toast(error, 'error') }
    else {
      toast('Ticket deleted.', 'success')
      setDeleteTarget(null)
      router.refresh()
    }
    setDeleteLoading(false)
  }

  async function handleCreate(data: import('@/types/issue.types').IssueCreate) {
    const { error } = await createIssueAction(projectId, data)
    if (error) { toast(error, 'error'); return }
    toast('Ticket created.', 'success')
    setCreateStatus(null)
    router.refresh()
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar — outside DndContext to avoid pointer event conflicts */}
      <div className="mx-6 mt-4 mb-0 flex items-center gap-3 flex-wrap shrink-0">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets..."
            className="pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          />
        </div>

        {/* Assignee avatar bubbles */}
        {members.length > 0 && (
          <AssigneeAvatars
            members={members}
            activeIds={filters.assignees}
            onToggle={(userId) =>
              setFilters((prev) => ({
                ...prev,
                assignees: prev.assignees.includes(userId)
                  ? prev.assignees.filter((id) => id !== userId)
                  : [...prev.assignees, userId],
              }))
            }
          />
        )}

        {/* Filter button */}
        <JiraFilterButton
          filters={filters}
          onChange={setFilters}
          sprints={sprints}
          members={members}
          types={projectTypes}
          labels={projectLabels}
          priorities={ALL_PRIORITIES}
          epics={epics}
          hasFilters={hasFilters}
        />

        {/* Group button */}
        <GroupButton groupBy={groupBy} onChange={setGroupBy} />
      </div>

      {activeChips.length > 0 && (
        <div className="mx-6 mt-2 flex items-center gap-1.5 flex-wrap shrink-0">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
            >
              {chip.label}
              <button onClick={() => removeChip(chip.field, chip.value)} className="hover:text-blue-900 ml-0.5">
                <X size={10} />
              </button>
            </span>
          ))}
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1"
          >
            Clear all
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >

        {groupBy === 'none' ? (
          /* ── Regular column layout ──
              Structurally identical to swimlane mode (which doesn't have
              the overlap issue): a wrapper div around the flex-row of
              columns. Per-column sticky headers naturally scroll away
              when each column's content is exhausted. */
          <div className="flex-1 min-h-0 px-6 pb-4 overflow-x-auto overflow-y-auto">
            <div className="mt-4">
              <div className="flex gap-3 items-start">
                {projectStatuses.map((s) => (
                  <KanbanColumn
                    key={s.id}
                    status={s}
                    issues={issuesByStatus[s.name] ?? []}
                    onCardClick={(issue) => router.push(`/project/${projectId}/issue/${issue.id}`)}
                    onCreateClick={() => setCreateStatus(s.name)}
                    onInlineUpdate={handleInlineUpdate}
                    members={members}
                    epics={epics}
                    projectTypes={projectTypes}
                    projectLabels={projectLabels}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── Swimlane layout ── */
          <div className="flex-1 min-h-0 px-6 pb-4 overflow-x-auto overflow-y-auto">
            {groups.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No tickets match current filters.</p>
            ) : groups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.id)
              const groupCount = boardIssues.filter((i) =>
                groupBy === 'assignee'
                  ? (i.assignee_id ?? '__unassigned__') === group.id
                  : (i.epic_id ?? '__none__') === group.id
              ).length
              const initials = group.label.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
              return (
                <div key={group.id} className="mt-4">
                  {/* Group header — clickable to collapse */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center gap-2 py-1.5 px-1 mb-2 rounded-lg hover:bg-gray-100 transition-colors w-full text-left"
                  >
                    <ChevronRight
                      size={14}
                      className={cn('text-gray-400 transition-transform shrink-0', !isCollapsed && 'rotate-90')}
                    />
                    {groupBy === 'assignee' && (
                      group.avatarUrl
                        ? <img src={group.avatarUrl} className="h-5 w-5 rounded-full object-cover shrink-0" alt="" />
                        : <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                            <span className="text-[8px] font-bold text-white">{initials}</span>
                          </div>
                    )}
                    {groupBy === 'epic' && (
                      group.color
                        ? <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                        : <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-gray-300" />
                    )}
                    <span className="text-sm font-semibold text-gray-800">{group.label}</span>
                    <span className="text-xs text-gray-400">{groupCount} ticket{groupCount !== 1 ? 's' : ''}</span>
                  </button>

                  {/* Columns — hidden when collapsed */}
                  {!isCollapsed && (
                    <div className="flex gap-3 items-start">
                      {projectStatuses.map((s) => (
                        <KanbanColumn
                          key={s.id}
                          status={s}
                          droppableId={`${group.id}||${s.name}`}
                          issues={getGroupIssues(group.id, s.name)}
                          onCardClick={(issue) => router.push(`/project/${projectId}/issue/${issue.id}`)}
                          onCreateClick={() => setCreateStatus(s.name)}
                          onInlineUpdate={handleInlineUpdate}
                          members={members}
                          epics={epics}
                          projectTypes={projectTypes}
                          projectLabels={projectLabels}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <DragOverlay dropAnimation={null}>
          {activeIssue && <KanbanCard issue={activeIssue} overlay />}
        </DragOverlay>
      </DndContext>

      {/* Create modal */}
      <Modal open={createStatus !== null} onClose={() => setCreateStatus(null)} title="Create ticket" size="xl">
        {createStatus !== null && (
          <IssueForm
            mode="create"
            projectId={projectId}
            defaultStatus={createStatus || undefined}
            members={members}
            sprints={sprints}
            epics={epics}
            defaultSprintId={null}
            onSubmit={handleCreate}
            onCancel={() => setCreateStatus(null)}
          />
        )}
      </Modal>

      {/* Edit modal */}
      <Modal open={editTarget !== null} onClose={() => setEditTarget(null)} title="Edit ticket" size="xl">
        {editTarget && (
          <IssueForm mode="edit" issue={editTarget} members={members} sprints={sprints} epics={epics} onSubmit={handleEdit} onCancel={() => setEditTarget(null)} />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete ticket"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Yes, delete"
      />
    </div>
  )
}

// ── GroupButton ───────────────────────────────────────────────────────────────

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'epic', label: 'Epic' },
]

function GroupButton({ groupBy, onChange }: { groupBy: GroupBy; onChange: (g: GroupBy) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const active = GROUP_OPTIONS.find((o) => o.value === groupBy)!

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl border transition-colors',
          groupBy !== 'none'
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
        )}
      >
        <Layers size={14} />
        Group
        {groupBy !== 'none' && (
          <span className="text-blue-600 font-semibold text-xs">{active.label}</span>
        )}
        <ChevronDown size={12} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-40 bg-white rounded-xl border border-gray-200 shadow-lg w-36 py-1">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors',
                groupBy === opt.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              {opt.label}
              {groupBy === opt.value && <span className="text-[10px] font-bold text-blue-600">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── JiraFilterButton ──────────────────────────────────────────────────────────

type FilterFieldId = 'sprints' | 'assignees' | 'labels' | 'priorities' | 'types' | 'parents'

interface FieldDef {
  id: FilterFieldId
  label: string
  options: { value: string; label: string; color?: string; avatarUrl?: string | null }[]
}

function JiraFilterButton({
  filters, onChange, sprints, members, types, labels, priorities, epics, hasFilters,
}: {
  filters: BoardFilters
  onChange: (f: BoardFilters) => void
  sprints: Sprint[]
  members: ProjectMemberPreview[]
  types: import('@/types/project-settings.types').ProjectIssueType[]
  labels: import('@/types/project-settings.types').ProjectLabel[]
  priorities: string[]
  epics: Epic[]
  hasFilters: boolean
}) {
  const [open, setOpen] = useState(false)
  const [activeField, setActiveField] = useState<FilterFieldId>('sprints')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const fields: FieldDef[] = [
    {
      id: 'sprints',
      label: 'Sprint',
      options: [
        { value: '__none__', label: 'No sprint' },
        ...sprints.map((s) => ({ value: s.id, label: s.name })),
      ],
    },
    {
      id: 'assignees',
      label: 'Assignee',
      options: [
        { value: '__unassigned__', label: 'Unassigned' },
        ...members.map((m) => ({
          value: m.user_id,
          label: m.profile?.full_name ?? m.user_id,
          avatarUrl: m.profile?.avatar_url ?? null,
          inactive: (m.profile?.status ?? 'active') !== 'active',
        })),
      ],
    },
    ...(epics.length > 0 ? [{
      id: 'parents' as FilterFieldId,
      label: 'Parent',
      options: [
        { value: '__none__', label: 'No parent' },
        ...epics.map((e) => ({ value: e.id, label: e.name, color: e.color })),
      ],
    }] : []),
    ...(labels.length > 0 ? [{
      id: 'labels' as FilterFieldId,
      label: 'Labels',
      options: labels.map((l) => ({ value: l.id, label: l.name, color: l.color })),
    }] : []),
    {
      id: 'priorities',
      label: 'Priority',
      options: priorities.map((p) => ({ value: p, label: priorityLabel(p as IssueWithDetails['priority']) })),
    },
    {
      id: 'types',
      label: 'Work type',
      options: types.map((t) => ({ value: t.name, label: formatSettingLabel(t.name) })),
    },
  ]

  const currentField = fields.find((f) => f.id === activeField) ?? fields[0]

  function toggle(field: FilterFieldId, value: string) {
    const current = filters[field]
    onChange({
      ...filters,
      [field]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    })
  }

  const totalActive = Object.values(filters).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl border transition-colors',
          hasFilters
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
        )}
      >
        <SlidersHorizontal size={14} />
        Filter
        {totalActive > 0 && (
          <span className="bg-blue-600 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
            {totalActive}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-40 bg-white rounded-xl border border-gray-200 shadow-2xl flex overflow-hidden"
          style={{ minWidth: 420 }}
        >
          {/* Left: field list */}
          <div className="w-44 border-r border-gray-100 py-1 bg-gray-50">
            <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Filter by</p>
            {fields.map((field) => {
              const count = filters[field.id].length
              const isActive = field.id === activeField
              return (
                <button
                  key={field.id}
                  onClick={() => setActiveField(field.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-white text-blue-700 font-semibold border-r-2 border-blue-500'
                      : 'text-gray-700 hover:bg-white'
                  )}
                >
                  <span>{field.label}</span>
                  <div className="flex items-center gap-1">
                    {count > 0 && (
                      <span className="bg-blue-600 text-white rounded-full px-1.5 text-[10px] font-bold leading-4">
                        {count}
                      </span>
                    )}
                    <ChevronRight size={12} className="text-gray-300" />
                  </div>
                </button>
              )
            })}
            {/* Clear all */}
            {totalActive > 0 && (
              <div className="border-t border-gray-100 mt-1 px-3 py-2">
                <button
                  onClick={() => onChange(EMPTY_FILTERS)}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>

          {/* Right: options */}
          <div className="flex-1 py-1 min-w-[220px]">
            <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {currentField.label}
            </p>
            <div className="max-h-64 overflow-y-auto">
              {currentField.options.map((opt) => {
                const checked = filters[currentField.id].includes(opt.value)
                const initials = opt.label.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggle(currentField.id, opt.value)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                      checked ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <span className={cn(
                      'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                      checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    )}>
                      {checked && <span className="text-white text-[9px] font-bold">✓</span>}
                    </span>

                    {/* Avatar (assignees) */}
                    {'avatarUrl' in opt && (
                      opt.avatarUrl ? (
                        <img src={opt.avatarUrl} className="h-5 w-5 rounded-full object-cover shrink-0" alt="" />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                          <span className="text-[8px] font-bold text-white">{initials}</span>
                        </div>
                      )
                    )}

                    {/* Color chip (labels) */}
                    {opt.color ? (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: opt.color + '22', color: opt.color }}
                      >
                        {opt.label}
                      </span>
                    ) : (
                      <span className="truncate">{opt.label}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Column ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  status, issues, onCardClick, onCreateClick, onInlineUpdate, members, epics, projectTypes, projectLabels, droppableId, hideHeader = false,
}: {
  status: ProjectStatus
  issues: IssueWithDetails[]
  onCardClick: (issue: IssueWithDetails) => void
  onCreateClick: () => void
  onInlineUpdate: (issueId: string, patch: IssueUpdate) => void
  members: ProjectMemberPreview[]
  epics: Epic[]
  projectTypes: ProjectType[]
  projectLabels: ProjectLabelType[]
  droppableId?: string
  hideHeader?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId ?? status.name })

  // Lazy-render cards: start with a window of CARDS_INITIAL and extend it
  // as the user scrolls — the sentinel below comes into view and bumps
  // `visibleCount` by CARDS_INCREMENT. The header counter still shows
  // `issues.length` (the real total), never the rendered window.
  const CARDS_INITIAL = 15
  const CARDS_INCREMENT = 15
  const [visibleCount, setVisibleCount] = useState(CARDS_INITIAL)
  useEffect(() => { setVisibleCount(CARDS_INITIAL) }, [issues.length])
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    if (visibleCount >= issues.length) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((c) => Math.min(c + CARDS_INCREMENT, issues.length))
      }
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [visibleCount, issues.length])

  const visibleIssues = visibleCount >= issues.length ? issues : issues.slice(0, visibleCount)

  return (
    <div className={cn(
      'group flex flex-col w-[272px] shrink-0 rounded-xl border transition-colors',
      isOver ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'
    )}>
      {!hideHeader && (
        <div className={cn(
          'flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 sticky top-0 z-30 rounded-t-xl',
          isOver ? 'bg-blue-50' : 'bg-gray-50',
        )}>
          <StatusBadge status={status.name} color={status.color ?? undefined} />
          <span className="ml-auto text-[11px] font-semibold text-gray-400 bg-white border border-gray-200 rounded-full px-1.5 py-0.5 leading-none">
            {issues.length}
          </span>
        </div>
      )}
      <div ref={setNodeRef} className="flex flex-col gap-2 p-2 min-h-[80px]">
        {visibleIssues.map((issue) => (
          <KanbanCard
            key={issue.id}
            issue={issue}
            onClick={() => onCardClick(issue)}
            onInlineUpdate={(patch) => onInlineUpdate(issue.id, patch)}
            members={members}
            epics={epics}
            projectTypes={projectTypes}
            projectLabels={projectLabels}
          />
        ))}
        {visibleCount < issues.length && <div ref={sentinelRef} className="h-1" />}
        {!status.requires_pause_reason && (
          <button
            onClick={onCreateClick}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          >
            <Plus size={13} />
            Create
          </button>
        )}
      </div>
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function KanbanCard({
  issue,
  overlay = false,
  onClick,
  onInlineUpdate,
  members,
  epics,
  projectTypes,
  projectLabels,
}: {
  issue: IssueWithDetails
  overlay?: boolean
  onClick?: () => void
  onInlineUpdate?: (patch: IssueUpdate) => void
  members?: ProjectMemberPreview[]
  epics?: Epic[]
  projectTypes?: ProjectType[]
  projectLabels?: ProjectLabelType[]
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(issue.title)
  useEffect(() => { setTitleDraft(issue.title) }, [issue.title])

  // Disable drag entirely while the title is being edited — otherwise pointer
  // events inside the input (text selection, etc.) can still trigger a drag
  // and the card "floats" away.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.id,
    data: { issue },
    disabled: overlay || editingTitle,
  })

  const style = transform && !overlay ? { transform: CSS.Translate.toString(transform) } : undefined

  const initials = issue.assignee?.full_name
    ? issue.assignee.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : null

  const interactive = !overlay && !!onInlineUpdate

  // Stop the drag listeners + the card's double-click from firing when the
  // user interacts with an inline editor. Pointer-down also has to be
  // stopped, or @dnd-kit will start tracking the pointer for a drag.
  const stop = (e: React.SyntheticEvent) => { e.stopPropagation() }

  function commitTitle() {
    const next = titleDraft.trim()
    if (next && next !== issue.title) onInlineUpdate?.({ title: next })
    else setTitleDraft(issue.title)
    setEditingTitle(false)
  }

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      onClick={overlay ? undefined : onClick}
      className={cn(
        'group/card bg-white rounded-lg border border-gray-200 p-3 shadow-sm select-none flex flex-col gap-2',
        isDragging && !overlay && 'opacity-30',
        overlay
          ? 'cursor-grabbing shadow-xl rotate-1 ring-2 ring-blue-300'
          : 'cursor-pointer hover:border-blue-300 hover:shadow-md transition-[border-color,box-shadow] duration-150'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-gray-400">{issue.key}</span>
        {interactive && projectTypes && projectTypes.length > 0 ? (
          <div
            className="relative inline-block cursor-pointer hover:bg-gray-100 rounded p-0.5 -m-0.5"
            onClick={stop}
            onPointerDown={stop}
            title="Change type"
          >
            <TypeIcon type={issue.type} />
            <select
              value={issue.type}
              onChange={(e) => onInlineUpdate!({ type: e.target.value as IssueWithDetails['type'] })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              {projectTypes.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <TypeIcon type={issue.type} />
        )}
      </div>

      {/* Epic chip — inline editable only when one is assigned */}
      {issue.epic && (
        interactive && epics ? (
          <CardEpicSelect issue={issue} epics={epics} onUpdate={onInlineUpdate!} />
        ) : (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full self-start"
            style={{ backgroundColor: issue.epic.color + '22', color: issue.epic.color }}
          >
            {issue.epic.name}
          </span>
        )
      )}

      {/* Labels — inline editable only when at least one is assigned */}
      {issue.labels && issue.labels.length > 0 && (
        interactive && projectLabels ? (
          <CardLabelsSelect issue={issue} allLabels={projectLabels} onUpdate={onInlineUpdate!} />
        ) : (
          <div className="flex flex-wrap gap-1">
            {issue.labels.map((label) => (
              <span
                key={label.id}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: label.color + '22', color: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )
      )}

      {/* Title — pencil icon on hover opens the inline editor */}
      {editingTitle ? (
        <div
          className="flex items-start gap-1"
          onClick={stop}
          onPointerDown={stop}
          onDoubleClick={stop}
        >
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitTitle() }
              else if (e.key === 'Escape') { setTitleDraft(issue.title); setEditingTitle(false) }
            }}
            className="flex-1 min-w-0 text-sm font-medium text-gray-800 leading-snug border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="button"
            onClick={(e) => { stop(e); commitTitle() }}
            className="shrink-0 p-1 rounded text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
            title="Save (Enter)"
          >
            <Check size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => { stop(e); setTitleDraft(issue.title); setEditingTitle(false) }}
            className="shrink-0 p-1 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Cancel (Esc)"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="relative flex items-start gap-1">
          <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2 flex-1">{issue.title}</p>
          {interactive && (
            <button
              type="button"
              onClick={(e) => { stop(e); setEditingTitle(true) }}
              onPointerDown={stop}
              onDoubleClick={stop}
              className="opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0 p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
              title="Edit title"
            >
              <Pencil size={11} />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-1">
        {interactive ? (
          <div
            className="relative inline-block cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1"
            onClick={stop}
            onPointerDown={stop}
            title="Change priority"
          >
            <PriorityIcon priority={issue.priority} />
            <select
              value={issue.priority}
              onChange={(e) => onInlineUpdate!({ priority: e.target.value as IssueWithDetails['priority'] })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              {ALL_PRIORITIES.map((p) => (
                <option key={p} value={p}>{priorityLabel(p)}</option>
              ))}
            </select>
          </div>
        ) : (
          <PriorityIcon priority={issue.priority} />
        )}

        {/* Assignee — inline editable only when one is assigned */}
        {issue.assignee && (
          interactive && members ? (
            <div
              className="relative inline-block cursor-pointer"
              onClick={stop}
              onPointerDown={stop}
              title={issue.assignee.full_name ?? 'Change assignee'}
            >
              <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${issue.assignee.status !== 'active' ? 'bg-gray-400' : 'bg-blue-500'}`}>
                {issue.assignee.avatar_url ? (
                  <img src={issue.assignee.avatar_url} className={`h-5 w-5 rounded-full object-cover ${issue.assignee.status !== 'active' ? 'grayscale opacity-60' : ''}`} alt="" />
                ) : (
                  <span className="text-[8px] font-bold text-white">{initials}</span>
                )}
              </div>
              <select
                value={issue.assignee_id ?? ''}
                onChange={(e) => onInlineUpdate!({ assignee_id: e.target.value || null })}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.profile?.full_name ?? m.user_id}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${issue.assignee.status !== 'active' ? 'bg-gray-400' : 'bg-blue-500'}`} title={`${issue.assignee.full_name ?? ''}${issue.assignee.status !== 'active' ? ' (Inactive)' : ''}`}>
              {issue.assignee.avatar_url ? (
                <img src={issue.assignee.avatar_url} className={`h-5 w-5 rounded-full object-cover ${issue.assignee.status !== 'active' ? 'grayscale opacity-60' : ''}`} alt="" />
              ) : (
                <span className="text-[8px] font-bold text-white">{initials}</span>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ── Inline epic selector (only rendered when the issue already has an epic) ─
function CardEpicSelect({ issue, epics, onUpdate }: {
  issue: IssueWithDetails
  epics: Epic[]
  onUpdate: (patch: IssueUpdate) => void
}) {
  const stop = (e: React.SyntheticEvent) => { e.stopPropagation() }
  if (!issue.epic) return null
  return (
    <div
      className="relative inline-block self-start cursor-pointer hover:opacity-80"
      onClick={stop}
      onPointerDown={stop}
      title="Change parent"
    >
      <span
        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ backgroundColor: issue.epic.color + '22', color: issue.epic.color }}
      >
        {issue.epic.name}
      </span>
      <select
        value={issue.epic_id ?? ''}
        onChange={(e) => onUpdate({ epic_id: e.target.value || null })}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        <option value="">No parent</option>
        {epics.map((ep) => (
          <option key={ep.id} value={ep.id}>{ep.name}</option>
        ))}
      </select>
    </div>
  )
}

// ── Inline labels multi-select (portal so it escapes the card's overflow) ───
function CardLabelsSelect({ issue, allLabels, onUpdate }: {
  issue: IssueWithDetails
  allLabels: ProjectLabelType[]
  onUpdate: (patch: IssueUpdate) => void
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLDivElement>(null)
  const selectedIds = useMemo(() => new Set((issue.labels ?? []).map((l) => l.id)), [issue.labels])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(true)
  }

  function toggle(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onUpdate({ label_ids: Array.from(next) })
  }

  // Only render when the issue already has at least one label assigned.
  if (!issue.labels || issue.labels.length === 0) return null

  return (
    <>
      <div
        ref={buttonRef}
        onClick={handleOpen}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className="cursor-pointer hover:bg-gray-100 rounded -mx-1 px-1 py-0.5"
        title="Change labels"
      >
        <div className="flex flex-wrap gap-1">
          {issue.labels.map((label) => (
            <span
              key={label.id}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: label.color + '22', color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      </div>
      {open && position && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[70] bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px] max-h-[300px] overflow-y-auto"
            style={{ top: position.top, left: position.left }}
          >
            <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Labels</p>
            {allLabels.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">No labels yet</p>
            ) : allLabels.map((label) => {
              const checked = selectedIds.has(label.id)
              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => toggle(label.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left"
                >
                  <input type="checkbox" checked={checked} readOnly className="h-3.5 w-3.5 accent-blue-500" />
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: label.color + '22', color: label.color }}
                  >
                    {label.name}
                  </span>
                </button>
              )
            })}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
