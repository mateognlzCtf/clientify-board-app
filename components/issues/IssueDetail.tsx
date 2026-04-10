'use client'

import { useState } from 'react'
import { Pencil, Trash2, Calendar, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils/dates'
import { Button } from '@/components/ui/Button'
import { TypeIcon } from '@/components/issues/TypeIcon'
import { CommentSection } from '@/components/issues/CommentSection'
import { statusLabel, ALL_STATUSES } from '@/components/issues/StatusBadge'
import { priorityLabel, ALL_PRIORITIES } from '@/components/issues/PriorityIcon'
import { useToast } from '@/providers/ToastProvider'
import { updateIssueAction } from '@/app/(dashboard)/project/[projectId]/actions'
import type { IssueWithDetails, IssueStatus, IssuePriority, IssueUpdate } from '@/types/issue.types'
import type { ProjectMemberPreview } from '@/services/projects.service'
import type { Sprint } from '@/types/sprint.types'

interface IssueDetailProps {
  issue: IssueWithDetails
  currentUserId: string
  projectId: string
  members: ProjectMemberPreview[]
  sprints?: Sprint[]
  onEdit: () => void
  onDelete: () => void
  onUpdated: (patch: Partial<IssueUpdate>) => void
}

const STATUS_CLASS: Record<IssueStatus, string> = {
  backlog:     'bg-gray-100 text-gray-600',
  todo:        'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  in_review:   'bg-purple-100 text-purple-700',
  done:        'bg-green-100 text-green-700',
}

const PRIORITY_CLASS: Record<IssuePriority, string> = {
  low:    'bg-gray-100 text-gray-500',
  medium: 'bg-blue-100 text-blue-600',
  high:   'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
}

export function IssueDetail({
  issue,
  currentUserId,
  projectId,
  members,
  sprints,
  onEdit,
  onDelete,
  onUpdated,
}: IssueDetailProps) {
  const { toast } = useToast()
  const [status, setStatus] = useState<IssueStatus>(issue.status)
  const [priority, setPriority] = useState<IssuePriority>(issue.priority)
  const [assigneeId, setAssigneeId] = useState<string>(issue.assignee_id ?? '')
  const [saving, setSaving] = useState<string | null>(null)

  const createdAt = new Date(issue.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
  const updatedAt = new Date(issue.updated_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
  const dueDate = issue.due_date ? formatDate(issue.due_date) : null

  async function handleChange(field: string, value: string) {
    const patch: IssueUpdate = { [field]: value || null }
    setSaving(field)

    const prev = { status, priority, assigneeId }
    if (field === 'status') setStatus(value as IssueStatus)
    if (field === 'priority') setPriority(value as IssuePriority)
    if (field === 'assignee_id') setAssigneeId(value)

    const { error } = await updateIssueAction(projectId, issue.id, patch)
    setSaving(null)

    if (error) {
      toast(error, 'error')
      setStatus(prev.status)
      setPriority(prev.priority)
      setAssigneeId(prev.assigneeId)
    } else {
      onUpdated(patch)
    }
  }

  const assignee = members.find((m) => m.user_id === assigneeId)?.profile

  return (
    <div className="flex gap-6">
      {/* Left: main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Key */}
        <span className="font-mono text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
          {issue.key}
        </span>

        {/* Description */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</p>
          {issue.description ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{issue.description}</p>
          ) : (
            <p className="text-sm text-gray-300 italic">No description provided.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <Button onClick={onEdit} variant="secondary" size="sm">
            <Pencil size={13} />
            Edit
          </Button>
          <Button
            onClick={onDelete}
            variant="secondary"
            size="sm"
            className="text-red-600 hover:bg-red-50 hover:border-red-200"
          >
            <Trash2 size={13} />
            Delete
          </Button>
        </div>

        {/* Comments */}
        <CommentSection issueId={issue.id} projectId={projectId} currentUserId={currentUserId} members={members} />
      </div>

      {/* Right: metadata */}
      <div className="w-48 shrink-0 space-y-4 text-sm">

        {/* Status */}
        <MetaRow label="Status">
          <div className="relative">
            <select
              value={status}
              disabled={saving === 'status'}
              onChange={(e) => handleChange('status', e.target.value)}
              className={`w-full appearance-none text-xs font-medium px-2 py-1 rounded cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-5 ${STATUS_CLASS[status]}`}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] opacity-60">▾</span>
          </div>
        </MetaRow>

        {/* Priority */}
        <MetaRow label="Priority">
          <div className="relative">
            <select
              value={priority}
              disabled={saving === 'priority'}
              onChange={(e) => handleChange('priority', e.target.value)}
              className={`w-full appearance-none text-xs font-medium px-2 py-1 rounded cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-5 ${PRIORITY_CLASS[priority]}`}
            >
              {ALL_PRIORITIES.map((p) => (
                <option key={p} value={p}>{priorityLabel(p)}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] opacity-60">▾</span>
          </div>
        </MetaRow>

        {/* Type (read-only) */}
        <MetaRow label="Type">
          <TypeIcon type={issue.type} showLabel />
        </MetaRow>

        {/* Assignee */}
        <MetaRow label="Assignee">
          <div className="relative">
            <select
              value={assigneeId}
              disabled={saving === 'assignee_id'}
              onChange={(e) => handleChange('assignee_id', e.target.value)}
              className="w-full appearance-none text-xs text-gray-700 px-2 py-1 rounded border border-gray-200 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 pr-5"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profile?.full_name ?? m.user_id}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">▾</span>
          </div>
          {assignee && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {assignee.avatar_url ? (
                <img src={assignee.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold text-white">
                    {assignee.full_name?.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() ?? '?'}
                  </span>
                </div>
              )}
              <span className="text-xs text-gray-600 truncate">{assignee.full_name ?? 'Unknown'}</span>
            </div>
          )}
        </MetaRow>

        {/* Reporter (read-only) */}
        <MetaRow label="Reporter">
          <UserChip person={issue.reporter} fallback="Unknown" />
        </MetaRow>

        {dueDate && (
          <MetaRow label="Due date">
            <span className="flex items-center gap-1 text-xs text-gray-600">
              <Calendar size={12} />
              {dueDate}
            </span>
          </MetaRow>
        )}

        {sprints && sprints.length > 0 && (
          <SprintMetaRow sprint={sprints.find((s) => s.id === issue.sprint_id) ?? null} />
        )}

        <div className="border-t border-gray-100 pt-3 space-y-2">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock size={11} />
            Created {createdAt}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock size={11} />
            Updated {updatedAt}
          </span>
        </div>
      </div>
    </div>
  )
}

function SprintMetaRow({ sprint }: { sprint: Sprint | null }) {
  return (
    <MetaRow label="Sprint">
      {sprint ? (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
          sprint.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'
        }`}>
          {sprint.name}
          {sprint.status === 'active' && <span className="text-[9px]">●</span>}
        </span>
      ) : (
        <span className="text-xs text-gray-400">Backlog</span>
      )}
    </MetaRow>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  )
}

function UserChip({
  person,
  fallback,
}: {
  person: { id: string; full_name: string | null; avatar_url: string | null } | null
  fallback: string
}) {
  if (!person) return <span className="text-xs text-gray-400">{fallback}</span>

  const initials = person.full_name
    ? person.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : '?'

  return (
    <div className="flex items-center gap-1.5">
      {person.avatar_url ? (
        <img src={person.avatar_url} alt={person.full_name ?? ''} className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
          <span className="text-[8px] font-bold text-white">{initials}</span>
        </div>
      )}
      <span className="text-xs text-gray-700 truncate">{person.full_name ?? 'Unknown'}</span>
    </div>
  )
}
