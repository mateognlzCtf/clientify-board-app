'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Trash2, Clock, ExternalLink, ChevronDown, Check, X, Tag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TypeIcon } from '@/components/issues/TypeIcon'
import { CommentSection, ImageLightbox } from '@/components/issues/CommentSection'
import { RichTextEditor, renderDescriptionHTML, parseDescription } from '@/components/issues/RichTextEditor'
import { priorityLabel, ALL_PRIORITIES } from '@/components/issues/PriorityIcon'
import { useProjectSettings, formatSettingLabel } from '@/contexts/ProjectSettingsContext'
import { formatLocalDate } from '@/lib/utils/dates'
import { useToast } from '@/providers/ToastProvider'
import { updateIssueAction, setIssueLabelsAction } from '@/app/(dashboard)/project/[projectId]/actions'
import { uploadCommentImageAction } from '@/app/(dashboard)/project/[projectId]/comment-actions'
import type { IssueWithDetails, IssueStatus, IssuePriority, IssueUpdate } from '@/types/issue.types'
import type { ProjectLabel } from '@/types/project-settings.types'
import type { ProjectMemberPreview } from '@/services/projects.service'
import type { Sprint } from '@/types/sprint.types'
import type { Epic } from '@/types/epic.types'
import type { JSONContent } from '@tiptap/core'

interface IssueDetailProps {
  issue: IssueWithDetails
  currentUserId: string
  projectId: string
  members: ProjectMemberPreview[]
  sprints?: Sprint[]
  epics?: Epic[]
  canDelete?: boolean
  onEdit: () => void
  onDelete: () => void
  onUpdated: (patch: Partial<IssueUpdate>) => void
}

const PRIORITY_CLASS: Record<IssuePriority, string> = {
  lowest:  'bg-blue-50 text-blue-400',
  low:     'bg-gray-100 text-gray-500',
  medium:  'bg-blue-100 text-blue-600',
  high:    'bg-orange-100 text-orange-600',
  highest: 'bg-red-100 text-red-600',
}

export function IssueDetail({
  issue,
  currentUserId,
  projectId,
  members,
  sprints,
  epics = [],
  canDelete = false,
  onEdit,
  onDelete,
  onUpdated,
}: IssueDetailProps) {
  const { toast } = useToast()
  const { statuses: projectStatuses, types: projectTypes, labels: projectLabels } = useProjectSettings()

  // Select / date fields
  const [status, setStatus] = useState<IssueStatus>(issue.status)
  const [priority, setPriority] = useState<IssuePriority>(issue.priority)
  const [assigneeId, setAssigneeId] = useState<string>(issue.assignee_id ?? '')
  const [sprintId, setSprintId] = useState<string>(issue.sprint_id ?? '')
  const [type, setType] = useState<string>(issue.type)
  const [dueDateRaw, setDueDateRaw] = useState<string>(issue.due_date ?? '')
  const [startDateRaw, setStartDateRaw] = useState<string>(issue.start_date ?? '')
  const [saving, setSaving] = useState<string | null>(null)

  // Inline text fields
  const [editingField, setEditingField] = useState<string | null>(null)
  const [title, setTitle] = useState(issue.title)
  const [draftTitle, setDraftTitle] = useState(issue.title)
  const [descriptionRaw, setDescriptionRaw] = useState(issue.description ?? '')
  const [descriptionHtml, setDescriptionHtml] = useState('')
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [slackThread, setSlackThread] = useState(issue.slack_thread ?? '')
  const [draftSlack, setDraftSlack] = useState(issue.slack_thread ?? '')
  const [pauseReason, setPauseReason] = useState(issue.pause_reason ?? '')
  const [draftPause, setDraftPause] = useState(issue.pause_reason ?? '')
  const [epicId, setEpicId] = useState<string>(issue.epic_id ?? '')
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(issue.labels?.map((l) => l.id) ?? [])

  // Sync all local state when issue prop changes (realtime update from another tab).
  // Skip inline-text fields that the user is actively editing to avoid clobbering drafts.
  useEffect(() => {
    setStatus(issue.status)
    setPriority(issue.priority)
    setAssigneeId(issue.assignee_id ?? '')
    setSprintId(issue.sprint_id ?? '')
    setType(issue.type)
    setDueDateRaw(issue.due_date ?? '')
    setStartDateRaw(issue.start_date ?? '')
    setEpicId(issue.epic_id ?? '')
    setSelectedLabelIds(issue.labels?.map((l) => l.id) ?? [])
    if (editingField !== 'title') { setTitle(issue.title); setDraftTitle(issue.title) }
    if (editingField !== 'description') setDescriptionRaw(issue.description ?? '')
    if (editingField !== 'slack_thread') { setSlackThread(issue.slack_thread ?? ''); setDraftSlack(issue.slack_thread ?? '') }
    if (editingField !== 'pause_reason') { setPauseReason(issue.pause_reason ?? ''); setDraftPause(issue.pause_reason ?? '') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue])

  // Rich editor ref
  const getDescriptionJson = useRef<(() => JSONContent) | null>(null)

  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const isOverdue = !!dueDateRaw && dueDateRaw < todayStr

  const createdAt = formatLocalDate(issue.created_at)
  const updatedAt = formatLocalDate(issue.updated_at)

  // Broadcast a patch to other tabs of the same browser via BroadcastChannel
  function broadcastPatch(patch: object) {
    const bc = new BroadcastChannel(`issue-sync-${issue.id}`)
    bc.postMessage(patch)
    bc.close()
  }

  // ── select/date handler ───────────────────────────────────────────────────
  async function handleChange(field: string, value: string) {
    const targetStatus = projectStatuses.find((s) => s.name === value)
    if (field === 'status' && targetStatus?.requires_pause_reason && !pauseReason.trim()) {
      toast('Fill in the Pause reason before setting this status.', 'error')
      return
    }
    const patch: IssueUpdate = { [field]: value || null }
    setSaving(field)
    const prev = { status, priority, assigneeId, sprintId, type, dueDateRaw, startDateRaw }
    if (field === 'status') setStatus(value as IssueStatus)
    if (field === 'priority') setPriority(value as IssuePriority)
    if (field === 'assignee_id') setAssigneeId(value)
    if (field === 'sprint_id') setSprintId(value)
    if (field === 'type') setType(value)
    if (field === 'due_date') setDueDateRaw(value)
    if (field === 'start_date') setStartDateRaw(value)
    if (field === 'epic_id') setEpicId(value)
    const { error } = await updateIssueAction(projectId, issue.id, patch)
    setSaving(null)
    if (error) {
      toast(error, 'error')
      setStatus(prev.status); setPriority(prev.priority)
      setAssigneeId(prev.assigneeId); setSprintId(prev.sprintId); setType(prev.type)
      setDueDateRaw(prev.dueDateRaw); setStartDateRaw(prev.startDateRaw)
    } else {
      onUpdated(patch)
      broadcastPatch(patch)
    }
  }

  // ── labels handler ───────────────────────────────────────────────────────
  async function handleLabelChange(newIds: string[]) {
    const prev = selectedLabelIds
    setSelectedLabelIds(newIds)
    setSaving('labels')
    const { error } = await setIssueLabelsAction(projectId, issue.id, newIds)
    setSaving(null)
    if (error) {
      toast(error, 'error')
      setSelectedLabelIds(prev)
    } else {
      const updatedLabels = projectLabels.filter((l) => newIds.includes(l.id))
      onUpdated({ labels: updatedLabels } as unknown as Partial<IssueUpdate>)
      broadcastPatch({ labels: updatedLabels })
    }
  }

  // ── inline text handler ───────────────────────────────────────────────────
  function startEdit(field: string) {
    if (field === 'title') setDraftTitle(title)
    if (field === 'slack_thread') setDraftSlack(slackThread)
    if (field === 'pause_reason') setDraftPause(pauseReason)
    setEditingField(field)
  }

  async function confirmEdit(field: string) {
    let value: string
    if (field === 'title') value = draftTitle.trim()
    else if (field === 'slack_thread') value = draftSlack.trim()
    else if (field === 'pause_reason') value = draftPause.trim()
    else if (field === 'description') {
      const json = getDescriptionJson.current?.()
      value = json ? JSON.stringify(json) : ''
    } else return

    const patch: IssueUpdate = { [field]: value || null } as IssueUpdate
    setSaving(field)
    const { error } = await updateIssueAction(projectId, issue.id, patch)
    setSaving(null)
    if (error) {
      toast(error, 'error')
    } else {
      if (field === 'title') setTitle(draftTitle.trim() || issue.title)
      if (field === 'description') setDescriptionRaw(value)
      if (field === 'slack_thread') setSlackThread(draftSlack)
      if (field === 'pause_reason') setPauseReason(draftPause)
      onUpdated(patch)
      broadcastPatch(patch)
    }
    setEditingField(null)
  }

  function cancelEdit() { setEditingField(null) }

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

  useEffect(() => {
    setDescriptionHtml(renderDescriptionHTML(descriptionRaw))
  }, [descriptionRaw])

  const assignee = members.find((m) => m.user_id === assigneeId)?.profile
  const currentSprint = sprints?.find((s) => s.id === sprintId) ?? null

  return (
    <div className="flex gap-0 min-h-0">

      {/* ── LEFT PANEL ── */}
      <div className="flex-1 min-w-0 pr-6 space-y-5 overflow-y-auto">

        {/* Epic breadcrumb */}
        {(epicId || epics.length > 0) && (
          <div className="flex items-center gap-1.5">
            <div className="relative inline-flex items-center">
              {epicId ? (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full cursor-pointer"
                  style={{ backgroundColor: (epics.find(e => e.id === epicId)?.color ?? '#6366f1') + '22', color: epics.find(e => e.id === epicId)?.color ?? '#6366f1' }}
                >
                  {epics.find(e => e.id === epicId)?.name ?? 'Epic'}
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic">No epic</span>
              )}
              <select
                value={epicId}
                disabled={saving === 'epic_id'}
                onChange={(e) => handleChange('epic_id', e.target.value)}
                className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-default"
              >
                <option value="">No epic</option>
                {epics.map((ep) => (
                  <option key={ep.id} value={ep.id}>{ep.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

      {/* Title */}
        <InlineText
          field="title"
          editing={editingField === 'title'}
          saving={saving === 'title'}
          onDoubleClick={() => startEdit('title')}
          onConfirm={() => confirmEdit('title')}
          onCancel={cancelEdit}
          renderView={() => <h1 className="text-lg font-semibold text-gray-900 leading-snug cursor-text select-none">{title}</h1>}
          renderInput={() => (
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit('title'); if (e.key === 'Escape') cancelEdit() }}
              className="w-full text-lg font-semibold text-gray-900 border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          )}
        />

        {/* Key details */}
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Key details</p>
          </div>
          <div className="px-4 py-3 space-y-4">

            {/* Description */}
            <DetailRow label="Description">
              {editingField === 'description' ? (
                <div className="space-y-2">
                  <RichTextEditor
                    initialContent={parseDescription(descriptionRaw)}
                    members={members}
                    placeholder="Describe the ticket…"
                    uploadImage={uploadImage}
                    onReady={handleEditorReady}
                    minHeight="140px"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => confirmEdit('description')}
                      disabled={saving === 'description'}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Check size={11} /> Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving === 'description'}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                    >
                      <X size={11} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    onDoubleClick={() => startEdit('description')}
                    title="Double-click to edit"
                    className="group relative cursor-text"
                    onClick={(e) => {
                      const t = e.target as HTMLElement
                      if (t.tagName === 'IMG') setLightboxSrc((t as HTMLImageElement).src)
                    }}
                  >
                    {descriptionHtml ? (
                      <div
                        className="tiptap-content text-sm text-gray-700 leading-relaxed select-none"
                        dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                      />
                    ) : (
                      <p className="text-sm text-gray-300 italic select-none">No description provided. Double-click to edit.</p>
                    )}
                    <span className="absolute -top-4 right-0 text-[9px] text-gray-300 hidden group-hover:block pointer-events-none select-none">
                      double-click to edit
                    </span>
                  </div>
                  {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
                </>
              )}
            </DetailRow>

            {/* Slack Thread */}
            <DetailRow label="Slack Thread">
              <InlineText
                field="slack_thread"
                editing={editingField === 'slack_thread'}
                saving={saving === 'slack_thread'}
                onDoubleClick={() => startEdit('slack_thread')}
                onConfirm={() => confirmEdit('slack_thread')}
                onCancel={cancelEdit}
                renderView={() => slackThread
                  ? <a href={slackThread} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                      <ExternalLink size={13} /> Open thread
                    </a>
                  : <span className="text-sm text-gray-300 italic cursor-text select-none">Add URL… double-click to edit.</span>
                }
                renderInput={() => (
                  <input
                    autoFocus
                    type="url"
                    value={draftSlack}
                    onChange={(e) => setDraftSlack(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit('slack_thread'); if (e.key === 'Escape') cancelEdit() }}
                    placeholder="https://app.slack.com/..."
                    className="w-full text-sm text-gray-700 border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-300"
                  />
                )}
              />
            </DetailRow>

            {/* Priority */}
            <DetailRow label="Priority">
              <div className="relative inline-flex">
                <div className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-md border ${PRIORITY_CLASS[priority]}`}>
                  <span>{priorityLabel(priority)}</span>
                  <ChevronDown size={13} className="opacity-50" />
                </div>
                <select
                  value={priority}
                  disabled={saving === 'priority'}
                  onChange={(e) => handleChange('priority', e.target.value)}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-default"
                >
                  {ALL_PRIORITIES.map((p) => (
                    <option key={p} value={p}>{priorityLabel(p)}</option>
                  ))}
                </select>
              </div>
            </DetailRow>

            {/* Pause reason */}
            <DetailRow label="Pause reason">
              <InlineText
                field="pause_reason"
                editing={editingField === 'pause_reason'}
                saving={saving === 'pause_reason'}
                onDoubleClick={() => startEdit('pause_reason')}
                onConfirm={() => confirmEdit('pause_reason')}
                onCancel={cancelEdit}
                renderView={() => pauseReason
                  ? <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap cursor-text select-none">{pauseReason}</p>
                  : <p className="text-sm text-gray-300 italic cursor-text select-none">Required to set status to Stopper…</p>
                }
                renderInput={() => (
                  <textarea
                    autoFocus
                    rows={2}
                    value={draftPause}
                    onChange={(e) => setDraftPause(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit() }}
                    placeholder="Required to set status to Stopper…"
                    className="w-full text-sm text-gray-700 border border-gray-300 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-300"
                  />
                )}
              />
              {projectStatuses.find((s) => s.name === status)?.requires_pause_reason && !pauseReason.trim() && editingField !== 'pause_reason' && (
                <p className="text-xs text-red-500 font-medium mt-1">Required to use this status.</p>
              )}
            </DetailRow>

          </div>
        </div>

        {/* Actions */}
        {canDelete && (
          <div className="flex gap-2">
            <Button onClick={onDelete} variant="secondary" size="sm" className="text-red-600 hover:bg-red-50 hover:border-red-200">
              <Trash2 size={13} /> Delete
            </Button>
          </div>
        )}

        {/* Comments */}
        <CommentSection issueId={issue.id} projectId={projectId} currentUserId={currentUserId} members={members} />
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="w-56 shrink-0 border-l border-gray-100 pl-6 space-y-5">

        {/* Status */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</p>
          <div className="relative">
            {(() => {
              const color = projectStatuses.find(s => s.name === status)?.color ?? '#6b7280'
              return (
                <div
                  style={{ backgroundColor: color + '22', color, borderColor: color + '66' }}
                  className="flex items-center justify-between text-sm font-semibold px-3 py-2 rounded-lg border"
                >
                  <span>{formatSettingLabel(status)}</span>
                  <ChevronDown size={14} className="opacity-60 shrink-0" />
                </div>
              )
            })()}
            <select
              value={status}
              disabled={saving === 'status'}
              onChange={(e) => handleChange('status', e.target.value)}
              className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-default"
            >
              {projectStatuses.map((s) => (
                <option key={s.id} value={s.name}>{formatSettingLabel(s.name)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Reporter */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reporter</p>
          <UserChip person={issue.reporter} fallback="Unknown" />
        </div>

        {/* Labels */}
        {projectLabels.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Labels</p>
            <InlineLabelPicker
              labels={projectLabels}
              selectedIds={selectedLabelIds}
              saving={saving === 'labels'}
              onChange={handleLabelChange}
            />
          </div>
        )}

        {/* Details container */}
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Details</p>
          </div>
          <div className="divide-y divide-gray-100">

            {/* Assignee */}
            <div className="px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Assignee</p>
              <div className="relative">
                <select
                  value={assigneeId}
                  disabled={saving === 'assignee_id'}
                  onChange={(e) => handleChange('assignee_id', e.target.value)}
                  className="w-full appearance-none text-xs text-gray-700 px-2 py-1 rounded border border-gray-200 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 pr-5"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.profile?.full_name ?? m.user_id}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">▾</span>
              </div>
              {assignee && (
                <div className="flex items-center gap-1.5">
                  {assignee.avatar_url
                    ? <img src={assignee.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                    : <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-bold text-white">
                          {assignee.full_name?.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() ?? '?'}
                        </span>
                      </div>
                  }
                  <span className="text-xs text-gray-600 truncate">{assignee.full_name ?? 'Unknown'}</span>
                </div>
              )}
            </div>

            {/* Due date */}
            <div className="px-3 py-2.5 space-y-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Due date</p>
              <input
                type="date"
                value={dueDateRaw}
                disabled={saving === 'due_date'}
                onChange={(e) => handleChange('due_date', e.target.value)}
                className={`w-full px-2 py-1 rounded text-xs font-medium border cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50
                  ${isOverdue ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-600 border-gray-200'}`}
              />
              {isOverdue && <p className="text-[10px] font-semibold text-red-500">Overdue</p>}
            </div>

            {/* Start date */}
            <div className="px-3 py-2.5 space-y-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Start date</p>
              <input
                type="date"
                value={startDateRaw}
                disabled={saving === 'start_date'}
                onChange={(e) => handleChange('start_date', e.target.value)}
                className="w-full px-2 py-1 rounded text-xs font-medium border border-gray-200 bg-white text-gray-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>

            {/* Sprint */}
            <div className="px-3 py-2.5 space-y-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Sprint</p>
              <div className="relative">
                <select
                  value={sprintId}
                  disabled={saving === 'sprint_id'}
                  onChange={(e) => handleChange('sprint_id', e.target.value)}
                  className="w-full appearance-none text-xs text-gray-700 px-2 py-1 rounded border border-gray-200 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 pr-5 disabled:opacity-50"
                >
                  <option value="">Backlog</option>
                  {sprints?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.status === 'active' ? ' (active)' : s.status === 'planning' ? ' (future)' : ''}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">▾</span>
              </div>
            </div>

            {/* Type */}
            <div className="px-3 py-2.5 space-y-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Type</p>
              <div className="relative inline-flex items-center">
                <div className="flex items-center gap-1.5 text-sm px-2 py-1 rounded border border-gray-200 bg-white">
                  <TypeIcon type={type} showLabel />
                  <ChevronDown size={12} className="text-gray-400 opacity-60" />
                </div>
                <select
                  value={type}
                  disabled={saving === 'type'}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-default"
                >
                  {projectTypes.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                  {/* Ensure current value always has a matching option to prevent spurious onChange */}
                  {!projectTypes.some((t) => t.name.toLowerCase() === type.toLowerCase()) && (
                    <option value={type}>{type}</option>
                  )}
                </select>
              </div>
            </div>

          </div>
        </div>

        {/* Timestamps */}
        <div className="space-y-1.5 pt-1">
          <span className="flex items-center gap-1 text-xs text-gray-400"><Clock size={11} />Created {createdAt}</span>
          <span className="flex items-center gap-1 text-xs text-gray-400"><Clock size={11} />Updated {updatedAt}</span>
        </div>
      </div>
    </div>
  )
}

// ── InlineText ────────────────────────────────────────────────────────────────

interface InlineTextProps {
  field: string
  editing: boolean
  saving: boolean
  onDoubleClick: () => void
  onConfirm: () => void
  onCancel: () => void
  renderView: () => React.ReactNode
  renderInput: () => React.ReactNode
}

function InlineText({ editing, saving, onDoubleClick, onConfirm, onCancel, renderView, renderInput }: InlineTextProps) {
  if (editing) {
    return (
      <div className="space-y-1.5">
        {renderInput()}
        <div className="flex gap-1.5">
          <button onClick={onConfirm} disabled={saving}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            <Check size={11} /> Save
          </button>
          <button onClick={onCancel} disabled={saving}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50">
            <X size={11} /> Cancel
          </button>
        </div>
      </div>
    )
  }
  return (
    <div onDoubleClick={onDoubleClick} title="Double-click to edit" className="group relative">
      {renderView()}
      <span className="absolute -top-4 right-0 text-[9px] text-gray-300 hidden group-hover:block pointer-events-none select-none">
        double-click to edit
      </span>
    </div>
  )
}

// ── DetailRow ─────────────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 items-start">
      <p className="text-sm text-gray-400 w-28 shrink-0 pt-0.5">{label}</p>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// ── UserChip ──────────────────────────────────────────────────────────────────

function UserChip({ person, fallback }: {
  person: { id: string; full_name: string | null; avatar_url: string | null } | null
  fallback: string
}) {
  if (!person) return <span className="text-xs text-gray-400">{fallback}</span>
  const initials = person.full_name
    ? person.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : '?'
  return (
    <div className="flex items-center gap-1.5">
      {person.avatar_url
        ? <img src={person.avatar_url} alt={person.full_name ?? ''} className="h-6 w-6 rounded-full object-cover" />
        : <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-white">{initials}</span>
          </div>
      }
      <span className="text-sm text-gray-700">{person.full_name ?? 'Unknown'}</span>
    </div>
  )
}

// ── InlineLabelPicker ─────────────────────────────────────────────────────────

function InlineLabelPicker({
  labels, selectedIds, saving, onChange,
}: {
  labels: ProjectLabel[]
  selectedIds: string[]
  saving: boolean
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
        disabled={saving}
        className="flex items-center gap-1 flex-wrap min-h-[28px] w-full text-left disabled:opacity-50"
      >
        {selected.length === 0 ? (
          <span className="flex items-center gap-1 text-xs text-gray-400 italic"><Tag size={11} /> None</span>
        ) : (
          selected.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: l.color + '22', color: l.color }}
            >
              {l.name}
            </span>
          ))
        )}
      </button>
      {open && (
        <div className="absolute z-20 right-0 mt-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
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
                  className="h-3.5 w-3.5 rounded border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: label.color, backgroundColor: checked ? label.color : 'transparent' }}
                >
                  {checked && <span className="text-white text-[8px] font-bold">✓</span>}
                </span>
                <span
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
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

// ── Image compression (same as CommentSection) ────────────────────────────────

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
