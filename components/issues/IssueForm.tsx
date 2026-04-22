'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Tag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ALL_PRIORITIES, priorityLabel } from '@/components/issues/PriorityIcon'
import { RichTextEditor, parseDescription } from '@/components/issues/RichTextEditor'
import { uploadCommentImageAction } from '@/app/(dashboard)/project/[projectId]/comment-actions'
import { useToast } from '@/providers/ToastProvider'
import { useProjectSettings, formatSettingLabel } from '@/contexts/ProjectSettingsContext'
import type { IssueCreate, IssueUpdate, IssueWithDetails, IssuePriority } from '@/types/issue.types'
import type { ProjectLabel } from '@/types/project-settings.types'
import type { ProjectMemberPreview } from '@/services/projects.service'
import type { Sprint } from '@/types/sprint.types'
import type { Epic } from '@/types/epic.types'
import type { JSONContent } from '@tiptap/core'

interface CreateModeProps {
  mode: 'create'
  projectId: string
  defaultStatus?: string
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
  epics?: Epic[]
  defaultSprintId?: string | null
}

export function IssueForm(props: IssueFormProps) {
  const { toast } = useToast()
  const { statuses: projectStatuses, types: projectTypes, labels: projectLabels } = useProjectSettings()
  const isEdit = props.mode === 'edit'
  const issue = isEdit ? (props as EditModeProps).issue : null

  const availableStatuses = isEdit
    ? projectStatuses
    : projectStatuses.filter((s) => !s.requires_pause_reason)

  const defaultStatus = (isEdit ? null : (props as CreateModeProps).defaultStatus) ?? availableStatuses[0]?.name ?? 'todo'
  const defaultType = projectTypes[0]?.name ?? 'task'

  const [title, setTitle] = useState(issue?.title ?? '')
  const [status, setStatus] = useState<string>(issue?.status ?? defaultStatus)
  const [priority, setPriority] = useState<IssuePriority>(issue?.priority ?? 'medium')
  const [type, setType] = useState<string>(issue?.type ?? defaultType)
  const [assigneeId, setAssigneeId] = useState<string>(issue?.assignee_id ?? '')
  const [dueDate, setDueDate] = useState(issue?.due_date ?? '')
  const [sprintId] = useState<string>(issue?.sprint_id ?? props.defaultSprintId ?? '')
  const [epicId, setEpicId] = useState<string>(issue?.epic_id ?? '')
  const epics = props.epics ?? []
  const [slackThread, setSlackThread] = useState(issue?.slack_thread ?? '')
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(issue?.labels?.map((l) => l.id) ?? [])
  const [loading, setLoading] = useState(false)
  const [titleError, setTitleError] = useState('')

  const getDescriptionJson = useRef<(() => JSONContent) | null>(null)
  const handleEditorReady = useCallback((getJson: () => JSONContent) => {
    getDescriptionJson.current = getJson
  }, [])

  async function uploadImage(file: File): Promise<string | null> {
    const compressed = await compressImage(file)
    const formData = new FormData()
    formData.append('file', new File([compressed], `desc_${Date.now()}.jpg`, { type: 'image/jpeg' }))
    const { data: src, error } = await uploadCommentImageAction(formData)
    if (error) { toast(error, 'error'); return null }
    return src ?? null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setTitleError('Title is required.'); return }
    setTitleError('')
    setLoading(true)

    const descJson = getDescriptionJson.current?.()
    const description = descJson ? JSON.stringify(descJson) : ''

    try {
      if (isEdit) {
        await (props as EditModeProps).onSubmit({
          title, description,
          status: status as IssueUpdate['status'],
          priority,
          type: type as IssueUpdate['type'],
          assignee_id: assigneeId || null,
          due_date: dueDate || null,
          sprint_id: sprintId || null,
          epic_id: epicId || null,
          slack_thread: slackThread || null,
          label_ids: selectedLabelIds,
        })
      } else {
        const p = props as CreateModeProps
        await p.onSubmit({
          project_id: p.projectId,
          title, description,
          status: status as IssueCreate['status'],
          priority,
          type: type as IssueCreate['type'],
          assignee_id: assigneeId || undefined,
          due_date: dueDate || undefined,
          sprint_id: sprintId || null,
          epic_id: epicId || null,
          slack_thread: slackThread || null,
          label_ids: selectedLabelIds,
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

      {/* Description — rich editor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <RichTextEditor
          initialContent={issue?.description ? parseDescription(issue.description) : null}
          members={props.members}
          placeholder="Add more details…"
          uploadImage={uploadImage}
          onReady={handleEditorReady}
          minHeight="100px"
        />
      </div>

      {/* Type / Status / Priority */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {projectTypes.map((t) => (
              <option key={t.id} value={t.name}>{formatSettingLabel(t.name)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableStatuses.map((s) => (
              <option key={s.id} value={s.name}>{formatSettingLabel(s.name)}</option>
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

      {/* Epic */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Epic</label>
        <select
          value={epicId}
          onChange={(e) => setEpicId(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">No epic</option>
          {epics.map((ep) => (
            <option key={ep.id} value={ep.id}>{ep.name}</option>
          ))}
        </select>
      </div>

      {/* Labels */}
      {projectLabels.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Labels</label>
          <LabelPicker
            labels={projectLabels}
            selectedIds={selectedLabelIds}
            onChange={setSelectedLabelIds}
          />
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
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Slack Thread */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Slack Thread <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="url"
          value={slackThread}
          onChange={(e) => setSlackThread(e.target.value)}
          placeholder="https://app.slack.com/..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-gray-400"
        />
      </div>

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

// ── LabelPicker ───────────────────────────────────────────────────────────────

function LabelPicker({
  labels, selectedIds, onChange,
}: {
  labels: ProjectLabel[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  const selected = labels.filter((l) => selectedIds.includes(l.id))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 flex-wrap min-h-[32px] w-full px-2 py-1 border border-gray-300 rounded-lg text-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left"
      >
        {selected.length === 0 ? (
          <span className="flex items-center gap-1 text-gray-400 text-xs"><Tag size={12} /> No labels</span>
        ) : (
          selected.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: l.color + '22', color: l.color }}
            >
              {l.name}
            </span>
          ))
        )}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
          {labels.map((label) => {
            const checked = selectedIds.includes(label.id)
            return (
              <button
                key={label.id}
                type="button"
                onClick={() => toggle(label.id)}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors"
              >
                <span
                  className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors`}
                  style={{ borderColor: label.color, backgroundColor: checked ? label.color : 'transparent' }}
                >
                  {checked && <span className="text-white text-[9px] font-bold">✓</span>}
                </span>
                <span
                  className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: label.color + '22', color: label.color }}
                >
                  {label.name}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function compressImage(file: File, maxWidth = 1000, quality = 0.75): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      const ratio = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objectUrl)
      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error('toBlob failed')) },
        'image/jpeg', quality,
      )
    }
    img.onerror = reject
    img.src = objectUrl
  })
}
