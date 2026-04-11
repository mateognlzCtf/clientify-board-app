'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { cn } from '@/lib/utils/cn'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IssueDetail } from '@/components/issues/IssueDetail'
import { IssueForm } from '@/components/issues/IssueForm'
import { StatusBadge, ALL_STATUSES } from '@/components/issues/StatusBadge'
import { PriorityIcon } from '@/components/issues/PriorityIcon'
import { TypeIcon } from '@/components/issues/TypeIcon'
import { useToast } from '@/providers/ToastProvider'
import type { IssueWithDetails, IssueStatus, IssueUpdate } from '@/types/issue.types'
import type { ProjectMemberPreview } from '@/services/projects.service'
import type { Sprint } from '@/types/sprint.types'
import type { Epic } from '@/types/epic.types'
import { updateIssueAction, deleteIssueAction } from '../actions'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { useRealtimeRefresh } from '@/lib/hooks/useRealtimeRefresh'
import { formatDate } from '@/lib/utils/dates'

interface KanbanBoardProps {
  projectId: string
  currentUserId: string
  issues: IssueWithDetails[]
  sprints: Sprint[]
  members: ProjectMemberPreview[]
  epics: Epic[]
}

export function KanbanBoard({ projectId, currentUserId, issues: initialIssues, sprints, members, epics }: KanbanBoardProps) {
  const router = useRouter()
  const { toast } = useToast()
  useRefreshOnFocus(() => setDetailTarget(null))
  useRealtimeRefresh(projectId)

  const activeSprint = sprints.find((s) => s.status === 'active') ?? null

  const [issues, setIssues] = useState<IssueWithDetails[]>(initialIssues)

  // Sync when server re-fetches after router.refresh()
  useEffect(() => { setIssues(initialIssues) }, [initialIssues])
  const [activeIssue, setActiveIssue] = useState<IssueWithDetails | null>(null)
  const [detailTarget, setDetailTarget] = useState<IssueWithDetails | null>(null)
  const [editTarget, setEditTarget] = useState<IssueWithDetails | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IssueWithDetails | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragStart({ active }: DragStartEvent) {
    const issue = issues.find((i) => i.id === active.id)
    if (issue) setActiveIssue(issue)
  }

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      setActiveIssue(null)
      if (!over) return
      const issue = issues.find((i) => i.id === active.id)
      const newStatus = over.id as IssueStatus
      if (!issue || issue.status === newStatus) return

      if (newStatus === 'stopper' && !issue.pause_reason?.trim()) {
        toast('Open the ticket and fill in Pause reason before moving to Stopper.', 'error')
        return
      }

      setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, status: newStatus } : i)))
      const { error } = await updateIssueAction(projectId, issue.id, { status: newStatus })
      if (error) { toast(error, 'error'); setIssues(initialIssues) }
      else router.refresh()
    },
    [issues, projectId, initialIssues, toast, router]
  )

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
      setDetailTarget(null)
      router.refresh()
    }
    setDeleteLoading(false)
  }

  const boardIssues = activeSprint
    ? issues.filter((i) => i.sprint_id === activeSprint.id)
    : issues

  const issuesByStatus = ALL_STATUSES.reduce<Record<IssueStatus, IssueWithDetails[]>>(
    (acc, status) => {
      acc[status] = boardIssues.filter((i) => i.status === status)
      return acc
    },
    {} as Record<IssueStatus, IssueWithDetails[]>
  )

  const doneCount = activeSprint ? boardIssues.filter((i) => i.status === 'done').length : 0
  const totalCount = boardIssues.length

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Sprint banner */}
        {activeSprint ? (
          <div className="mx-6 mt-4 mb-0 rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 uppercase tracking-wide">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
              Active Sprint
            </span>
            <span className="font-semibold text-sm text-gray-800">{activeSprint.name}</span>
            {activeSprint.start_date && activeSprint.end_date && (
              <span className="text-xs text-gray-400">
                {formatDate(activeSprint.start_date)} – {formatDate(activeSprint.end_date)}
              </span>
            )}
            {totalCount > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <div className="h-1.5 w-24 rounded-full bg-green-200 overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.round((doneCount / totalCount) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{doneCount}/{totalCount} done</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-6 mt-4 mb-0 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-400">
            No active sprint — showing all issues. Start a sprint from the{' '}
            <a href="backlog" className="text-blue-500 hover:underline">Backlog</a>.
          </div>
        )}
        <div className="flex gap-3 px-6 py-4 overflow-x-auto pb-8 items-start">
          {ALL_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              issues={issuesByStatus[status]}
              onCardClick={setDetailTarget}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeIssue && <KanbanCard issue={activeIssue} overlay />}
        </DragOverlay>
      </DndContext>

      {/* Ticket detail modal */}
      <Modal open={detailTarget !== null} onClose={() => setDetailTarget(null)} title={detailTarget?.key ?? ''} size="2xl" externalHref={detailTarget ? `/project/${projectId}/issue/${detailTarget.id}` : undefined}>
        {detailTarget && (
          <IssueDetail
            issue={detailTarget}
            currentUserId={currentUserId}
            projectId={projectId}
            members={members}
            sprints={sprints}
            epics={epics}
            onEdit={() => { setDetailTarget(null); setEditTarget(detailTarget) }}
            onDelete={() => { setDetailTarget(null); setDeleteTarget(detailTarget) }}
            onUpdated={(patch) => {
              setDetailTarget((prev) => prev ? { ...prev, ...patch } : prev)
              setIssues((prev) => prev.map((i) => i.id === detailTarget.id ? { ...i, ...patch } : i))
            }}
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
    </>
  )
}

// ── Column ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  status, issues, onCardClick,
}: {
  status: IssueStatus
  issues: IssueWithDetails[]
  onCardClick: (issue: IssueWithDetails) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className={cn(
      'flex flex-col w-[272px] shrink-0 rounded-xl border transition-colors',
      isOver ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'
    )}>
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200">
        <StatusBadge status={status} />
        <span className="ml-auto text-[11px] font-semibold text-gray-400 bg-white border border-gray-200 rounded-full px-1.5 py-0.5 leading-none">
          {issues.length}
        </span>
      </div>

      {/* Cards area — scrollable */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 p-2 min-h-[80px] max-h-[calc(100vh-260px)] overflow-y-auto"
      >
        {issues.map((issue) => (
          <KanbanCard key={issue.id} issue={issue} onClick={() => onCardClick(issue)} />
        ))}
        {issues.length === 0 && (
          <p className="text-[11px] text-gray-300 text-center py-6 select-none">No issues</p>
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
}: {
  issue: IssueWithDetails
  overlay?: boolean
  onClick?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.id,
    data: { issue },
    disabled: overlay,
  })

  const style = transform && !overlay ? { transform: CSS.Translate.toString(transform) } : undefined

  const initials = issue.assignee?.full_name
    ? issue.assignee.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : null

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      onClick={overlay ? undefined : onClick}
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-3 shadow-sm select-none flex flex-col gap-2',
        isDragging && !overlay && 'opacity-30',
        overlay
          ? 'cursor-grabbing shadow-xl rotate-1 ring-2 ring-blue-300'
          : 'cursor-pointer hover:border-blue-300 hover:shadow-md transition-all'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-gray-400">{issue.key}</span>
        <TypeIcon type={issue.type} />
      </div>
      {issue.epic && (
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full self-start"
          style={{ backgroundColor: issue.epic.color + '22', color: issue.epic.color }}
        >
          {issue.epic.name}
        </span>
      )}
      <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2">{issue.title}</p>
      <div className="flex items-center justify-between mt-1">
        <PriorityIcon priority={issue.priority} />
        {issue.assignee && (
          <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0" title={issue.assignee.full_name ?? ''}>
            {issue.assignee.avatar_url ? (
              <img src={issue.assignee.avatar_url} className="h-5 w-5 rounded-full object-cover" alt="" />
            ) : (
              <span className="text-[8px] font-bold text-white">{initials}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
