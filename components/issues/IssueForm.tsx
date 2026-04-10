'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ALL_STATUSES, statusLabel } from '@/components/issues/StatusBadge'
import { ALL_PRIORITIES, priorityLabel } from '@/components/issues/PriorityIcon'
import { ALL_TYPES, typeLabel } from '@/components/issues/TypeIcon'
import type { IssueCreate, IssueUpdate, IssueWithDetails, IssueStatus, IssuePriority, IssueType } from '@/types/issue.types'
import type { ProjectMemberPreview } from '@/services/projects.service'
import type { Sprint } from '@/types/sprint.types'

interface CreateModeProps {
  mode: 'create'
  projectId: string
  onSubmit: (data: IssueCreate) => Promise<void>
}

interface EditModeProps {
  mode: 'edit'
  issue: IssueWithDetails
  onSubmit: (data: IssueUpdate) => Promise<void>
}

type IssueFormProps = (CreateModeProps | EditModeProps) & {
  onCancel: () => void
  members: ProjectMemberPreview[]
  sprints?: Sprint[]
  defaultSprintId?: string | null
}

export function IssueForm(props: IssueFormProps) {
  const isEdit = props.mode === 'edit'
  const issue = isEdit ? (props as EditModeProps).issue : null

  const [title, setTitle] = useState(issue?.title ?? '')
  const [description, setDescription] = useState(issue?.description ?? '')
  const [status, setStatus] = useState<IssueStatus>(issue?.status ?? 'backlog')
  const [priority, setPriority] = useState<IssuePriority>(issue?.priority ?? 'medium')
  const [type, setType] = useState<IssueType>(issue?.type ?? 'task')
  const [assigneeId, setAssigneeId] = useState<string>(issue?.assignee_id ?? '')
  const [dueDate, setDueDate] = useState(issue?.due_date ?? '')
  const [sprintId, setSprintId] = useState<string>(issue?.sprint_id ?? props.defaultSprintId ?? '')
  const [loading, setLoading] = useState(false)
  const [titleError, setTitleError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setTitleError('Title is required.'); return }
    setTitleError('')
    setLoading(true)

    try {
      if (isEdit) {
        await (props as EditModeProps).onSubmit({
          title, description, status, priority, type,
          assignee_id: assigneeId || null,
          due_date: dueDate || null,
          sprint_id: sprintId || null,
        })
      } else {
        const p = props as CreateModeProps
        await p.onSubmit({
          project_id: p.projectId,
          title, description, status, priority, type,
          assignee_id: assigneeId || undefined,
          due_date: dueDate || undefined,
          sprint_id: sprintId || null,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Briefly describe the ticket..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-gray-400"
        />
        {titleError && <p className="mt-1 text-xs text-red-600">{titleError}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Add more details..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-gray-400"
        />
      </div>

      {/* Type / Status / Priority */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as IssueType)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>{typeLabel(t)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as IssueStatus)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as IssuePriority)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ALL_PRIORITIES.map((p) => (
              <option key={p} value={p}>{priorityLabel(p)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Assignee */}
      {props.members.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Assignee</label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Unassigned</option>
            {props.members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profile?.full_name ?? m.user_id}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Due date */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Due date <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Sprint */}
      {props.sprints && props.sprints.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sprint</label>
          <select
            value={sprintId}
            onChange={(e) => setSprintId(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Backlog (no sprint)</option>
            {props.sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.status === 'active' ? ' (active)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={props.onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {isEdit ? 'Save changes' : 'Create ticket'}
        </Button>
      </div>
    </form>
  )
}
