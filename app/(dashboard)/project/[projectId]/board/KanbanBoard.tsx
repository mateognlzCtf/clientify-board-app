'use client'

import { useState, useCallback } from 'react'
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
import { updateIssueAction, deleteIssueAction } from '../actions'

interface KanbanBoardProps {
  projectId: string
  currentUserId: string
  issues: IssueWithDetails[]
  sprints: Sprint[]
  members: ProjectMemberPreview[]
}

export function KanbanBoard({ projectId, currentUserId, issues: initialIssues, sprints, members }: KanbanBoardProps) {
  const router = useRouter()
  const { toast } = useToast()

  const activeSprint = sprints.find((s) => s.status === 'active') ?? null

  const [issues, setIssues] = useState<IssueWithDetails[]>(initialIssues)
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
                {new Date(activeSprint.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' – '}
                {new Date(activeSprint.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
        <div className="flex gap-3 p-6 h-full overflow-x-auto pb-8">
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
      <Modal open={detailTarget !== null} onClose={() => setDetailTarget(null)} title={detailTarget?.title ?? ''} size="xl">
        {detailTarget && (
          <IssueDetail
            issue={detailTarget}
            currentUserId={currentUserId}
            projectId={projectId}
            members={members}
            sprints={sprints}
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
      <Modal open={editTarget !== null} onClose={() => setEditTarget(null)} title="Edit ticket">
        {editTarget && (
          <IssueForm mode="edit" issue={editTarget} members={members} sprints={sprints} onSubmit={handleEdit} onCancel={() => setEditTarget(null)} />
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
    <div className="flex flex-col w-64 shrink-0">
      <div className="flex items-center gap-2 mb-2 px-1">
        <StatusBadge status={status} />
        <span className="text-xs font-semibold text-gray-400">{issues.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 flex-1 rounded-xl p-2 min-h-[200px] transition-colors',
          isOver ? 'bg-blue-50 ring-2 ring-blue-200' : 'bg-gray-50'
        )}
      >
        {issues.map((issue) => (
          <KanbanCard key={issue.id} issue={issue} onClick={() => onCardClick(issue)} />
        ))}
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
