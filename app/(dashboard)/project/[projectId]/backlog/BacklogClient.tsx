'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  DndContext, DragOverlay, useDroppable, useDraggable,
  PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, ChevronDown, ChevronRight, Play, CheckSquare,
  Pencil, Trash2, Flag, Calendar, MoreHorizontal, GripVertical, Search,
} from 'lucide-react'
import { JiraFilterButton, type FilterFieldDef } from '@/components/issues/JiraFilterButton'
import { AssigneeAvatars } from '@/components/issues/AssigneeAvatars'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IssueForm } from '@/components/issues/IssueForm'
import { IssueDetail } from '@/components/issues/IssueDetail'
import { StatusBadge } from '@/components/issues/StatusBadge'
import { PriorityIcon, ALL_PRIORITIES, priorityLabel } from '@/components/issues/PriorityIcon'
import { TypeIcon } from '@/components/issues/TypeIcon'
import { useToast } from '@/providers/ToastProvider'
import { useProjectSettings, formatSettingLabel } from '@/contexts/ProjectSettingsContext'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/dates'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { useRealtimeRefresh } from '@/lib/hooks/useRealtimeRefresh'
import type { IssueWithDetails, IssueCreate, IssueUpdate, IssuePriority } from '@/types/issue.types'
import type { Sprint, SprintCreate, SprintUpdate } from '@/types/sprint.types'
import type { ProjectMemberPreview } from '@/services/projects.service'
import type { Epic } from '@/types/epic.types'
import {
  createSprintAction, updateSprintAction, deleteSprintAction,
  startSprintAction, completeSprintAction,
} from '../sprint-actions'
import { createIssueAction, updateIssueAction, deleteIssueAction } from '../actions'

interface Props {
  projectId: string
  currentUserId: string
  canDelete: boolean
  issues: IssueWithDetails[]
  sprints: Sprint[]
  members: ProjectMemberPreview[]
  epics: Epic[]
}

export function BacklogClient({ projectId, currentUserId, canDelete, issues, sprints: initialSprints, members, epics: initialEpics }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { statuses: projectStatuses, types: projectTypes, labels: projectLabels } = useProjectSettings()
  useRefreshOnFocus(() => setDetailTarget(null))
  useRealtimeRefresh(projectId)

  const [sprints, setSprints] = useState<Sprint[]>(initialSprints)
  const [allIssues, setAllIssues] = useState<IssueWithDetails[]>(issues)
  const [epics, setEpics] = useState<Epic[]>(initialEpics)

  // Sync when server re-fetches after router.refresh()
  useEffect(() => { setSprints(initialSprints) }, [initialSprints])
  useEffect(() => { setAllIssues(issues) }, [issues])
  useEffect(() => {
    if (!detailTarget) return
    const fresh = issues.find((i) => i.id === detailTarget.id)
    if (fresh) setDetailTarget(fresh)
  }, [issues])
  const [draggingIssue, setDraggingIssue] = useState<IssueWithDetails | null>(null)

  const [searchQuery, setSearchQuery] = useState('')

  // Filters
  const [filters, setFilters] = useState<Record<string, string[]>>({
    assignees: [], statuses: [], priorities: [], types: [], epics: [], labels: [],
  })

  const hasFilters = Object.values(filters).some((v) => v.length > 0)

  const filteredIssues = useMemo(() => {
    return allIssues.filter((issue) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!issue.title.toLowerCase().includes(q) && !issue.key.toLowerCase().includes(q)) return false
      }
      if (filters.assignees.length > 0 && !filters.assignees.includes(issue.assignee_id ?? '__unassigned__')) return false
      if (filters.statuses.length > 0 && !filters.statuses.includes(issue.status)) return false
      if (filters.priorities.length > 0 && !filters.priorities.includes(issue.priority)) return false
      if (filters.types.length > 0 && !filters.types.includes(issue.type)) return false
      if (filters.epics.length > 0 && !filters.epics.includes(issue.epic_id ?? '__none__')) return false
      if (filters.labels.length > 0 && !filters.labels.some((id) => issue.labels?.some((l) => l.id === id))) return false
      return true
    })
  }, [allIssues, filters, searchQuery])

  // Sprint modals
  const [sprintFormOpen, setSprintFormOpen] = useState(false)
  const [editSprint, setEditSprint] = useState<Sprint | null>(null)
  const [deleteSprint, setDeleteSprintTarget] = useState<Sprint | null>(null)
  const [deleteSprintLoading, setDeleteSprintLoading] = useState(false)
  const [startSprintTarget, setStartSprintTarget] = useState<Sprint | null>(null)
  const [startSprintLoading, setStartSprintLoading] = useState(false)
  const [completeSprintTarget, setCompleteSprintTarget] = useState<Sprint | null>(null)

  // Open create modal when ?new=1 is in the URL
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreateIssueSprintId(null)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('new')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }, [searchParams])

  // Issue modals
  const [createIssueSprintId, setCreateIssueSprintId] = useState<string | null | undefined>(undefined)
  const [detailTarget, setDetailTarget] = useState<IssueWithDetails | null>(null)
  const [editIssueTarget, setEditIssueTarget] = useState<IssueWithDetails | null>(null)
  const [deleteIssueTarget, setDeleteIssueTarget] = useState<IssueWithDetails | null>(null)
  const [deleteIssueLoading, setDeleteIssueLoading] = useState(false)

  const issuesBySprint = useMemo(() => {
    const map = new Map<string | null, IssueWithDetails[]>()
    map.set(null, [])
    for (const sprint of sprints) map.set(sprint.id, [])
    for (const issue of filteredIssues) {
      const key = issue.sprint_id ?? null
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(issue)
    }
    return map
  }, [filteredIssues, sprints])

  const activeSprint = sprints.find((s) => s.status === 'active') ?? null
  const planningSprints = sprints
    .filter((s) => s.status === 'planning')
    .sort((a, b) => {
      if (!a.start_date && !b.start_date) return 0
      if (!a.start_date) return 1
      if (!b.start_date) return -1
      return a.start_date.localeCompare(b.start_date)
    })
  const backlogIssues = issuesBySprint.get(null) ?? []

  /** Format a Date as YYYY-MM-DD (local time, no UTC shift). */
  function fmtDate(dt: Date): string {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }

  /** Auto-calculate start/end for the next sprint based on the latest existing end_date. */
  function getNextSprintDates(): { startDate: string; endDate: string } {
    const latestEnd = sprints
      .map((s) => s.end_date)
      .filter(Boolean)
      .sort()
      .at(-1)

    if (!latestEnd) return { startDate: '', endDate: '' }

    const [y, m, d] = latestEnd.split('-').map(Number)
    return {
      startDate: fmtDate(new Date(y, m - 1, d + 1)),
      endDate:   fmtDate(new Date(y, m - 1, d + 14)),
    }
  }

  /** Generate the next sprint name by incrementing the trailing number (e.g. "Tablero 40" → "Tablero 41"). */
  function getNextSprintName(fromSprint: Sprint): string {
    const match = fromSprint.name.match(/^(.*?)(\d+)\s*$/)
    if (match) return `${match[1]}${parseInt(match[2]) + 1}`
    return `${fromSprint.name} 2`
  }

  /** Silently create the next planning sprint and add it to state. */
  async function autoCreateNextSprint(afterSprint: Sprint) {
    const name = getNextSprintName(afterSprint)
    const endDate = afterSprint.end_date
    let startDate = ''
    let nextEndDate = ''
    if (endDate) {
      const [y, m, d] = endDate.split('-').map(Number)
      startDate   = fmtDate(new Date(y, m - 1, d + 1))
      nextEndDate = fmtDate(new Date(y, m - 1, d + 14))
    }
    const { data: next, error } = await createSprintAction(projectId, {
      project_id: projectId,
      name,
      start_date: startDate || undefined,
      end_date: nextEndDate || undefined,
    })
    if (!error && next) setSprints((prev) => [...prev, next])
  }

  // On mount: if there's an active sprint but no planning sprints, auto-create the next one.
  const autoCreatedRef = useRef(false)
  useEffect(() => {
    if (autoCreatedRef.current) return
    const active = sprints.find((s) => s.status === 'active')
    const hasPlanning = sprints.some((s) => s.status === 'planning')
    if (active && !hasPlanning) {
      autoCreatedRef.current = true
      autoCreateNextSprint(active)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── dnd-kit ─────────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const issue = allIssues.find((i) => i.id === event.active.id)
    setDraggingIssue(issue ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingIssue(null)
    const { active, over } = event
    if (!over) return
    const issue = allIssues.find((i) => i.id === active.id)
    if (!issue) return
    const targetSprintId = over.id === 'backlog' ? null : (over.id as string)
    const currentSprintId = issue.sprint_id ?? null
    if (currentSprintId === targetSprintId) return
    handleMoveIssue(issue, targetSprintId)
  }

  // ── Sprint actions ───────────────────────────────────────────────────────────

  async function handleCreateSprint(data: SprintCreate | SprintUpdate) {
    const { data: sprint, error } = await createSprintAction(projectId, data as SprintCreate)
    if (error) { toast(error, 'error'); return }
    setSprints((prev) => [...prev, sprint!])
    setSprintFormOpen(false)
    toast('Sprint created.', 'success')
  }

  async function handleUpdateSprint(data: SprintUpdate) {
    if (!editSprint) return
    const { data: updated, error } = await updateSprintAction(projectId, editSprint.id, data)
    if (error) { toast(error, 'error'); return }
    setSprints((prev) => prev.map((s) => s.id === editSprint.id ? updated! : s))
    setEditSprint(null)
    toast('Sprint updated.', 'success')
  }

  async function handleDeleteSprint() {
    if (!deleteSprint) return
    setDeleteSprintLoading(true)
    const { error } = await deleteSprintAction(projectId, deleteSprint.id)
    setDeleteSprintLoading(false)
    if (error) { toast(error, 'error'); return }
    setSprints((prev) => prev.filter((s) => s.id !== deleteSprint.id))
    setAllIssues((prev) => prev.map((i) => i.sprint_id === deleteSprint.id ? { ...i, sprint_id: null } : i))
    setDeleteSprintTarget(null)
    toast('Sprint deleted.', 'success')
  }

  async function handleStartSprint() {
    if (!startSprintTarget) return
    setStartSprintLoading(true)
    const { data: updated, error } = await startSprintAction(projectId, startSprintTarget.id)
    setStartSprintLoading(false)
    if (error) { toast(error, 'error'); return }

    const updatedSprint = updated!
    setSprints((prev) => prev.map((s) => s.id === startSprintTarget.id ? updatedSprint : s))
    setStartSprintTarget(null)
    toast(`Sprint "${updatedSprint.name}" started.`, 'success')

    // Auto-create the next planning sprint if none remain
    const hasPlanning = sprints.some((s) => s.status === 'planning' && s.id !== startSprintTarget.id)
    if (!hasPlanning) {
      await autoCreateNextSprint(updatedSprint)
    }
  }

  async function handleCompleteSprint(moveToSprintId: string | null) {
    if (!completeSprintTarget) return
    const { error } = await completeSprintAction(projectId, completeSprintTarget.id, moveToSprintId)
    if (error) { toast(error, 'error'); return }
    setSprints((prev) => prev.filter((s) => s.id !== completeSprintTarget.id))
    setAllIssues((prev) => prev.map((i) => {
      if (i.sprint_id !== completeSprintTarget.id) return i
      if (i.status === 'done') return i
      return { ...i, sprint_id: moveToSprintId }
    }))
    setCompleteSprintTarget(null)
    toast('Sprint completed.', 'success')
  }

  // ── Issue actions ────────────────────────────────────────────────────────────

  async function handleCreateIssue(data: IssueCreate) {
    const { data: issue, error } = await createIssueAction(projectId, {
      ...data,
      sprint_id: createIssueSprintId,
    })
    if (error) { toast(error, 'error'); return }
    setAllIssues((prev) => [...prev, issue as IssueWithDetails])
    setCreateIssueSprintId(undefined)
    toast('Ticket created.', 'success')
    router.refresh()
  }

  async function handleEditIssue(data: IssueUpdate) {
    if (!editIssueTarget) return
    const { error } = await updateIssueAction(projectId, editIssueTarget.id, data)
    if (error) { toast(error, 'error'); return }
    setAllIssues((prev) => prev.map((i) => i.id === editIssueTarget.id ? { ...i, ...data } : i))
    setEditIssueTarget(null)
    toast('Ticket updated.', 'success')
    router.refresh()
  }

  async function handleDeleteIssue() {
    if (!deleteIssueTarget) return
    setDeleteIssueLoading(true)
    const { error } = await deleteIssueAction(projectId, deleteIssueTarget.id)
    setDeleteIssueLoading(false)
    if (error) { toast(error, 'error'); return }
    setAllIssues((prev) => prev.filter((i) => i.id !== deleteIssueTarget.id))
    setDeleteIssueTarget(null)
    setDetailTarget(null)
    toast('Ticket deleted.', 'success')
  }

  async function handleMoveIssue(issue: IssueWithDetails, targetSprintId: string | null) {
    const { error } = await updateIssueAction(projectId, issue.id, { sprint_id: targetSprintId })
    if (error) { toast(error, 'error'); return }
    setAllIssues((prev) => prev.map((i) => i.id === issue.id ? { ...i, sprint_id: targetSprintId } : i))
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="px-6 py-5 max-w-5xl mx-auto space-y-4">

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
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

          {/* Assignee bubbles */}
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

          {/* Filter */}
          <JiraFilterButton
            fields={[
              {
                id: 'assignees', label: 'Assignee',
                options: [
                  { value: '__unassigned__', label: 'Unassigned' },
                  ...members.map((m) => ({ value: m.user_id, label: m.profile?.full_name ?? m.user_id, avatarUrl: m.profile?.avatar_url ?? null })),
                ],
              },
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
                id: 'epics', label: 'Epic',
                options: [
                  { value: '__none__', label: 'No epic' },
                  ...epics.map((ep) => ({ value: ep.id, label: ep.name })),
                ],
              },
              ...(projectLabels.length > 0 ? [{
                id: 'labels', label: 'Labels',
                options: projectLabels.map((l) => ({ value: l.id, label: l.name, color: l.color })),
              } satisfies FilterFieldDef] : []),
            ]}
            values={filters}
            onChange={setFilters}
          />
        </div>

        {/* Active sprint */}
        {activeSprint && (
          <SprintSection
            sprint={activeSprint}
            issues={issuesBySprint.get(activeSprint.id) ?? []}
            allSprints={sprints}
            onEdit={() => setEditSprint(activeSprint)}
            onComplete={() => setCompleteSprintTarget(activeSprint)}
            onAddIssue={() => setCreateIssueSprintId(activeSprint.id)}
            onIssueClick={setDetailTarget}
            onMoveIssue={handleMoveIssue}
            defaultOpen
          />
        )}

        {/* Planning sprints */}
        {planningSprints.map((sprint) => (
          <SprintSection
            key={sprint.id}
            sprint={sprint}
            issues={issuesBySprint.get(sprint.id) ?? []}
            allSprints={sprints}
            onEdit={() => setEditSprint(sprint)}
            onDelete={() => setDeleteSprintTarget(sprint)}
            onStart={() => setStartSprintTarget(sprint)}
            onAddIssue={() => setCreateIssueSprintId(sprint.id)}
            onIssueClick={setDetailTarget}
            onMoveIssue={handleMoveIssue}
            defaultOpen
          />
        ))}

        {/* Backlog */}
        <BacklogSection
          issues={backlogIssues}
          sprints={planningSprints}
          onCreateSprint={() => setSprintFormOpen(true)}
          onAddIssue={() => setCreateIssueSprintId(null)}
          onIssueClick={setDetailTarget}
          onMoveIssue={handleMoveIssue}
        />

        {/* ── Modals ── */}

        <Modal open={sprintFormOpen} onClose={() => setSprintFormOpen(false)} title="Create sprint">
          <SprintForm
            projectId={projectId}
            defaultStartDate={getNextSprintDates().startDate}
            defaultEndDate={getNextSprintDates().endDate}
            onSubmit={handleCreateSprint}
            onCancel={() => setSprintFormOpen(false)}
          />
        </Modal>

        <Modal open={editSprint !== null} onClose={() => setEditSprint(null)} title="Edit sprint">
          {editSprint && (
            <SprintForm projectId={projectId} sprint={editSprint} onSubmit={handleUpdateSprint} onCancel={() => setEditSprint(null)} />
          )}
        </Modal>

        <ConfirmDialog
          open={deleteSprint !== null}
          onClose={() => setDeleteSprintTarget(null)}
          onConfirm={handleDeleteSprint}
          loading={deleteSprintLoading}
          title="Delete sprint"
          description={`Delete "${deleteSprint?.name}"? Issues in this sprint will be moved to the backlog.`}
          confirmLabel="Delete"
        />

        <ConfirmDialog
          open={startSprintTarget !== null}
          onClose={() => setStartSprintTarget(null)}
          onConfirm={handleStartSprint}
          loading={startSprintLoading}
          title="Start sprint"
          description={`Start "${startSprintTarget?.name}"? This will become the active sprint.`}
          confirmLabel="Start sprint"
        />

        {completeSprintTarget && (
          <CompleteSprintDialog
            sprint={completeSprintTarget}
            incompleteCount={(issuesBySprint.get(completeSprintTarget.id) ?? []).filter((i) => i.status !== 'done').length}
            planningSprints={planningSprints.filter((s) => s.id !== completeSprintTarget.id)}
            onConfirm={handleCompleteSprint}
            onClose={() => setCompleteSprintTarget(null)}
          />
        )}

        <Modal open={createIssueSprintId !== undefined} onClose={() => setCreateIssueSprintId(undefined)} title="New ticket" size="xl">
          <IssueForm
            mode="create"
            projectId={projectId}
            members={members}
            sprints={sprints}
            epics={epics}
            defaultSprintId={createIssueSprintId ?? null}
            onSubmit={handleCreateIssue}
            onCancel={() => setCreateIssueSprintId(undefined)}
          />
        </Modal>

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
              onEdit={() => { setDetailTarget(null); setEditIssueTarget(detailTarget) }}
              onDelete={() => { setDetailTarget(null); setDeleteIssueTarget(detailTarget) }}
              onUpdated={(patch) => {
                const resolved = patch.label_ids !== undefined
                  ? { ...patch, labels: projectLabels.filter((l) => patch.label_ids!.includes(l.id)) }
                  : patch
                setDetailTarget((prev) => prev ? { ...prev, ...resolved } : prev)
                setAllIssues((prev) => prev.map((i) => i.id === detailTarget.id ? { ...i, ...resolved } : i))
              }}
            />
          )}
        </Modal>

        <Modal open={editIssueTarget !== null} onClose={() => setEditIssueTarget(null)} title="Edit ticket" size="xl">
          {editIssueTarget && (
            <IssueForm mode="edit" issue={editIssueTarget} members={members} sprints={sprints} epics={epics} onSubmit={handleEditIssue} onCancel={() => setEditIssueTarget(null)} />
          )}
        </Modal>

        <ConfirmDialog
          open={deleteIssueTarget !== null}
          onClose={() => setDeleteIssueTarget(null)}
          onConfirm={handleDeleteIssue}
          loading={deleteIssueLoading}
          title="Delete ticket"
          description={`Delete "${deleteIssueTarget?.title}"? This cannot be undone.`}
          confirmLabel="Yes, delete"
        />
      </div>

      {/* Ghost element while dragging */}
      <DragOverlay dropAnimation={null}>
        {draggingIssue && <IssueRowGhost issue={draggingIssue} />}
      </DragOverlay>
    </DndContext>
  )
}

// ── SprintSection ─────────────────────────────────────────────────────────────

function SprintSection({
  sprint, issues, allSprints,
  onEdit, onDelete, onStart, onComplete, onAddIssue, onIssueClick, onMoveIssue,
  defaultOpen = false,
}: {
  sprint: Sprint
  issues: IssueWithDetails[]
  allSprints: Sprint[]
  onEdit: () => void
  onDelete?: () => void
  onStart?: () => void
  onComplete?: () => void
  onAddIssue: () => void
  onIssueClick: (i: IssueWithDetails) => void
  onMoveIssue: (i: IssueWithDetails, sprintId: string | null) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const { setNodeRef, isOver } = useDroppable({ id: sprint.id })

  const isActive = sprint.status === 'active'
  const total = issues.length

  const dateRange = [sprint.start_date, sprint.end_date]
    .filter(Boolean)
    .map((d) => formatDate(d!))
    .join(' – ')

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <button onClick={() => setOpen((o) => !o)} className="text-gray-400 hover:text-gray-600 transition-colors">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">{sprint.name}</span>
            {isActive && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 rounded">
                Active
              </span>
            )}
            {dateRange && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Calendar size={11} />
                {dateRange}
              </span>
            )}
            {sprint.goal && (
              <span className="flex items-center gap-1 text-xs text-gray-400 italic">
                <Flag size={10} />
                {sprint.goal}
              </span>
            )}
            <span className="text-xs text-gray-400">({total} work items)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onStart && (
            <button
              onClick={onStart}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Play size={11} />
              Start sprint
            </button>
          )}
          {onComplete && (
            <button
              onClick={onComplete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <CheckSquare size={11} />
              Complete sprint
            </button>
          )}
          <button onClick={onEdit} className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors" title="Edit sprint">
            <Pencil size={13} />
          </button>
          {onDelete && (
            <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors" title="Delete sprint">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Drop zone */}
      {open && (
        <div
          ref={setNodeRef}
          className={cn('min-h-[40px] transition-colors', isOver && 'bg-blue-50')}
        >
          {issues.length === 0 && !isOver && (
            <p className="text-xs text-gray-400 italic px-4 py-3">No issues in this sprint.</p>
          )}
          {isOver && issues.length === 0 && (
            <div className="flex items-center justify-center py-4 text-xs text-blue-500">
              Drop here
            </div>
          )}
          <div className="divide-y divide-gray-50">
            {issues.map((issue) => (
              <DraggableIssueRow
                key={issue.id}
                issue={issue}
                sprints={allSprints}
                currentSprintId={sprint.id}
                onIssueClick={onIssueClick}
                onMoveIssue={onMoveIssue}
              />
            ))}
          </div>
          <div className="px-4 py-2 border-t border-gray-50">
            <button
              onClick={onAddIssue}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors"
            >
              <Plus size={13} />
              Add issue
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── BacklogSection ────────────────────────────────────────────────────────────

function BacklogSection({
  issues, sprints, onCreateSprint, onAddIssue, onIssueClick, onMoveIssue,
}: {
  issues: IssueWithDetails[]
  sprints: Sprint[]
  onCreateSprint: () => void
  onAddIssue: () => void
  onIssueClick: (i: IssueWithDetails) => void
  onMoveIssue: (i: IssueWithDetails, sprintId: string | null) => void
}) {
  const [open, setOpen] = useState(true)
  const { setNodeRef, isOver } = useDroppable({ id: 'backlog' })

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <button onClick={() => setOpen((o) => !o)} className="text-gray-400 hover:text-gray-600 transition-colors">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <span className="flex-1 font-semibold text-sm text-gray-900">
          Backlog <span className="text-gray-400 font-normal">({issues.length} issues)</span>
        </span>
        <Button size="sm" variant="secondary" onClick={onCreateSprint}>
          <Plus size={13} />
          Create sprint
        </Button>
      </div>

      {open && (
        <div
          ref={setNodeRef}
          className={cn('min-h-[40px] transition-colors', isOver && 'bg-blue-50')}
        >
          {issues.length === 0 && !isOver && (
            <p className="text-xs text-gray-400 italic px-4 py-3">Backlog is empty.</p>
          )}
          {isOver && issues.length === 0 && (
            <div className="flex items-center justify-center py-4 text-xs text-blue-500">Drop here</div>
          )}
          <div className="divide-y divide-gray-50">
            {issues.map((issue) => (
              <DraggableIssueRow
                key={issue.id}
                issue={issue}
                sprints={sprints}
                currentSprintId={null}
                onIssueClick={onIssueClick}
                onMoveIssue={onMoveIssue}
              />
            ))}
          </div>
          <div className="px-4 py-2 border-t border-gray-50">
            <button
              onClick={onAddIssue}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors"
            >
              <Plus size={13} />
              Add issue
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DraggableIssueRow ─────────────────────────────────────────────────────────

function DraggableIssueRow({
  issue, sprints, currentSprintId, onIssueClick, onMoveIssue,
}: {
  issue: IssueWithDetails
  sprints: Sprint[]
  currentSprintId: string | null
  onIssueClick: (i: IssueWithDetails) => void
  onMoveIssue: (i: IssueWithDetails, sprintId: string | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: issue.id })
  const [menuOpen, setMenuOpen] = useState(false)

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const inSprint = currentSprintId !== null
  const otherSprints = sprints.filter((s) => s.id !== currentSprintId && s.status !== 'completed')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors',
        isDragging && 'opacity-40 bg-blue-50'
      )}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none shrink-0"
        tabIndex={-1}
      >
        <GripVertical size={14} />
      </button>

      <TypeIcon type={issue.type} />
      <span className="font-mono text-[11px] text-gray-400 w-16 shrink-0">{issue.key}</span>
      <button
        onClick={() => onIssueClick(issue)}
        className="flex-1 text-left text-sm text-gray-800 hover:text-blue-600 transition-colors truncate font-medium"
      >
        {issue.title}
      </button>
      {issue.epic && (
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 hidden sm:inline-flex"
          style={{ backgroundColor: issue.epic.color + '22', color: issue.epic.color }}
        >
          {issue.epic.name}
        </span>
      )}
      {issue.labels?.map((label) => (
        <span
          key={label.id}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 hidden md:inline-flex"
          style={{ backgroundColor: label.color + '22', color: label.color }}
        >
          {label.name}
        </span>
      ))}

      <div className="flex items-center gap-2 shrink-0">
        {issue.due_date && (
          <span className={cn(
            'text-[11px] font-medium flex items-center gap-1',
            issue.due_date < new Date().toISOString().slice(0, 10) ? 'text-red-500' : 'text-gray-400'
          )}>
            <Calendar size={11} />
            {formatDate(issue.due_date)}
          </span>
        )}
        <StatusBadge status={issue.status} />
        <PriorityIcon priority={issue.priority} />
        {issue.assignee && (
          <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0" title={issue.assignee.full_name ?? ''}>
            {issue.assignee.avatar_url ? (
              <img src={issue.assignee.avatar_url} className="h-5 w-5 rounded-full object-cover" alt="" />
            ) : (
              <span className="text-[8px] font-bold text-white">
                {issue.assignee.full_name?.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
              </span>
            )}
          </div>
        )}

        {/* Move menu */}
        <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
            title="Move to..."
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                {inSprint && (
                  <button
                    onClick={() => { onMoveIssue(issue, null); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Move to Backlog
                  </button>
                )}
                {otherSprints.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { onMoveIssue(issue, s.id); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Move to {s.name}
                  </button>
                ))}
                {!inSprint && otherSprints.length === 0 && (
                  <p className="px-3 py-1.5 text-xs text-gray-400 italic">No sprints available</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── IssueRowGhost (drag overlay) ──────────────────────────────────────────────

function IssueRowGhost({ issue }: { issue: IssueWithDetails }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white border border-blue-300 rounded-lg shadow-lg opacity-95 max-w-2xl">
      <GripVertical size={14} className="text-gray-300 shrink-0" />
      <TypeIcon type={issue.type} />
      <span className="font-mono text-[11px] text-gray-400 w-16 shrink-0">{issue.key}</span>
      <span className="flex-1 text-sm text-gray-800 truncate font-medium">{issue.title}</span>
      <StatusBadge status={issue.status} />
      <PriorityIcon priority={issue.priority} />
    </div>
  )
}

// ── SprintForm ────────────────────────────────────────────────────────────────

function SprintForm({
  projectId, sprint, defaultStartDate = '', defaultEndDate = '', onSubmit, onCancel,
}: {
  projectId: string
  sprint?: Sprint
  defaultStartDate?: string
  defaultEndDate?: string
  onSubmit: (data: SprintCreate | SprintUpdate) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(sprint?.name ?? '')
  const [goal, setGoal] = useState(sprint?.goal ?? '')
  const [startDate, setStartDate] = useState(sprint?.start_date ?? defaultStartDate)
  const [endDate, setEndDate] = useState(sprint?.end_date ?? defaultEndDate)
  const [loading, setLoading] = useState(false)
  const [nameError, setNameError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setNameError('Name is required.'); return }
    setNameError('')
    setLoading(true)
    try {
      if (sprint) {
        await (onSubmit as (d: SprintUpdate) => Promise<void>)({
          name, goal: goal || null, start_date: startDate || null, end_date: endDate || null,
        })
      } else {
        await (onSubmit as (d: SprintCreate) => Promise<void>)({
          project_id: projectId, name, goal: goal || undefined,
          start_date: startDate || undefined, end_date: endDate || undefined,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Sprint name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sprint 1"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Goal <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="What should this sprint achieve?"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>{sprint ? 'Save changes' : 'Create sprint'}</Button>
      </div>
    </form>
  )
}

// ── CompleteSprintDialog ──────────────────────────────────────────────────────

function CompleteSprintDialog({
  sprint, incompleteCount, planningSprints, onConfirm, onClose,
}: {
  sprint: Sprint
  incompleteCount: number
  planningSprints: Sprint[]
  onConfirm: (moveToSprintId: string | null) => Promise<void>
  onClose: () => void
}) {
  const [moveToSprintId, setMoveToSprintId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    await onConfirm(moveToSprintId || null)
    setLoading(false)
  }

  return (
    <Modal open onClose={onClose} title="Complete sprint">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          You are completing <span className="font-semibold">{sprint.name}</span>.
        </p>

        {incompleteCount > 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">{incompleteCount} issue{incompleteCount !== 1 ? 's' : ''}</span> not done. Where should they go?
            </p>
            <select
              value={moveToSprintId}
              onChange={(e) => setMoveToSprintId(e.target.value)}
              className="mt-2 w-full px-2 py-1.5 border border-yellow-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
            >
              <option value="">Move to Backlog</option>
              {planningSprints.map((s) => (
                <option key={s.id} value={s.id}>Move to {s.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            All issues are done.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleConfirm} loading={loading}>Complete sprint</Button>
        </div>
      </div>
    </Modal>
  )
}
