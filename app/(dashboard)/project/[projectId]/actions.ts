'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createIssue as createIssueService,
  updateIssue as updateIssueService,
  deleteIssue as deleteIssueService,
} from '@/services/issues.service'
import { setIssueLabels } from '@/services/project-labels.service'
import type { IssueCreate, IssueUpdate, Issue } from '@/types/issue.types'
import type { ServiceResult } from '@/types/common.types'
import {
  sendAssignmentEvent,
  sendStatusChangeEvent,
  sendIssueUpdatedEvent,
  type EventRecipient,
} from '@/lib/email'

async function getAuthenticatedUser() {
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) redirect('/login')
  return user
}

export async function createIssueAction(
  projectId: string,
  data: IssueCreate
): Promise<ServiceResult<Issue>> {
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await createIssueService(supabase, user.id, data)

  if (!result.error) {
    revalidatePath(`/project/${projectId}/list`)
    revalidatePath(`/project/${projectId}/backlog`)

    // Set labels if provided
    if (result.data && data.label_ids !== undefined) {
      await setIssueLabels(supabase, result.data.id, data.label_ids)
    }

    // Notify assignment if different from creator
    if (result.data && data.assignee_id) {
      void fireAssignmentEvent({
        supabase,
        assigneeId: data.assignee_id,
        actorId: user.id,
        issue: result.data,
        projectId,
      })
    }
  }

  return result
}

export async function updateIssueAction(
  projectId: string,
  issueId: string,
  data: IssueUpdate
): Promise<ServiceResult<Issue>> {
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()

  // Fetch previous state before updating to detect changes
  const { data: previous } = await supabase
    .from('issues')
    .select('assignee_id, title, description, status, priority, type, due_date, start_date, sprint_id, epic_id, pause_reason')
    .eq('id', issueId)
    .single()

  // Auto-set resolved_at when status changes to/from a completed status
  let enrichedData = data
  if (data.status !== undefined) {
    const { data: statusConfig } = await supabase
      .from('project_statuses')
      .select('is_completed')
      .eq('project_id', projectId)
      .eq('name', data.status)
      .single()
    enrichedData = { ...data, resolved_at: statusConfig?.is_completed ? new Date().toISOString() : null }
  }

  const result = await updateIssueService(supabase, issueId, enrichedData)

  if (!result.error && result.data) {
    revalidatePath(`/project/${projectId}/list`)
    revalidatePath(`/project/${projectId}/backlog`)
    revalidatePath(`/project/${projectId}/board`)

    // Set labels if provided
    if (data.label_ids !== undefined) {
      await setIssueLabels(supabase, issueId, data.label_ids)
    }

    const newAssigneeId = result.data.assignee_id
    const reporterId = result.data.reporter_id

    // Notify on status change — single webhook with recipients array
    if (data.status) {
      void fireStatusChangeEvent({
        supabase,
        actorId: user.id,
        reporterId,
        assigneeId: newAssigneeId,
        issue: result.data,
        projectId,
        from: previous?.status ?? null,
        to: data.status,
      })
    }

    // Notify on reassignment
    if (
      data.assignee_id !== undefined &&
      newAssigneeId &&
      newAssigneeId !== previous?.assignee_id
    ) {
      void fireAssignmentEvent({
        supabase,
        assigneeId: newAssigneeId,
        actorId: user.id,
        issue: result.data,
        projectId,
      })
    }

    // Notify on field updates (excluding status — has its own event)
    const changes = detectChanges(previous, data, result.data)
    await resolveSprintNames(supabase, changes)
    if (changes.length > 0) {
      void fireIssueUpdatedEvent({
        supabase,
        actorId: user.id,
        reporterId,
        assigneeId: newAssigneeId,
        issue: result.data,
        projectId,
        changes,
      })
    }
  }

  return result
}

export async function deleteIssueAction(
  projectId: string,
  issueId: string
): Promise<ServiceResult<null>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await deleteIssueService(supabase, issueId)

  if (!result.error) {
    revalidatePath(`/project/${projectId}/list`)
    revalidatePath(`/project/${projectId}/backlog`)
    revalidatePath(`/project/${projectId}/board`)
  }

  return result
}

export async function setIssueLabelsAction(
  projectId: string,
  issueId: string,
  labelIds: string[],
): Promise<ServiceResult<null>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await setIssueLabels(supabase, issueId, labelIds)
  if (!result.error) {
    revalidatePath(`/project/${projectId}/list`)
    revalidatePath(`/project/${projectId}/backlog`)
    revalidatePath(`/project/${projectId}/board`)
  }
  return result
}

// ── Event helpers ─────────────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>

async function getProfile(supabase: AdminClient, id: string) {
  const { data } = await supabase.from('profiles').select('id, email, full_name').eq('id', id).single()
  return data
}

async function fireAssignmentEvent({
  supabase, assigneeId, actorId, issue, projectId,
}: {
  supabase: AdminClient
  assigneeId: string
  actorId: string
  issue: Issue
  projectId: string
}) {
  try {
    const [assignee, actor] = await Promise.all([
      getProfile(supabase, assigneeId),
      getProfile(supabase, actorId),
    ])
    if (!actor) return

    const recipients: EventRecipient[] = []
    if (assignee && assignee.id !== actor.id) {
      recipients.push({
        email: assignee.email,
        name: assignee.full_name ?? assignee.email,
        role: 'assignee',
      })
    }

    await sendAssignmentEvent({
      issue: { id: issue.id, key: issue.key, title: issue.title },
      actor: { id: actor.id, name: actor.full_name ?? actor.email, email: actor.email },
      recipients,
      projectId,
    })
  } catch (err) {
    console.error('[fireAssignmentEvent]', err)
  }
}

async function fireStatusChangeEvent({
  supabase, actorId, reporterId, assigneeId, issue, projectId, from, to,
}: {
  supabase: AdminClient
  actorId: string
  reporterId: string | null
  assigneeId: string | null
  issue: Issue
  projectId: string
  from: string | null
  to: string
}) {
  try {
    const ids = [actorId, reporterId, assigneeId].filter((id): id is string => !!id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', ids)
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

    const actor = profileById.get(actorId)
    if (!actor) return

    const recipients: EventRecipient[] = []
    if (assigneeId && assigneeId !== actorId) {
      const p = profileById.get(assigneeId)
      if (p) recipients.push({ email: p.email, name: p.full_name ?? p.email, role: 'assignee' })
    }
    if (reporterId && reporterId !== actorId && reporterId !== assigneeId) {
      const p = profileById.get(reporterId)
      if (p) recipients.push({ email: p.email, name: p.full_name ?? p.email, role: 'reporter' })
    }

    await sendStatusChangeEvent({
      issue: { id: issue.id, key: issue.key, title: issue.title },
      actor: { id: actor.id, name: actor.full_name ?? actor.email, email: actor.email },
      changes: { from, to },
      recipients,
      projectId,
    })
  } catch (err) {
    console.error('[fireStatusChangeEvent]', err)
  }
}

async function fireIssueUpdatedEvent({
  supabase, actorId, reporterId, assigneeId, issue, projectId, changes,
}: {
  supabase: AdminClient
  actorId: string
  reporterId: string | null
  assigneeId: string | null
  issue: Issue
  projectId: string
  changes: { field: string; from: string | null; to: string | null }[]
}) {
  try {
    const ids = [actorId, reporterId, assigneeId].filter((id): id is string => !!id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', ids)
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

    const actor = profileById.get(actorId)
    if (!actor) return

    const recipients: EventRecipient[] = []
    if (assigneeId && assigneeId !== actorId) {
      const p = profileById.get(assigneeId)
      if (p) recipients.push({ email: p.email, name: p.full_name ?? p.email, role: 'assignee' })
    }
    if (reporterId && reporterId !== actorId && reporterId !== assigneeId) {
      const p = profileById.get(reporterId)
      if (p) recipients.push({ email: p.email, name: p.full_name ?? p.email, role: 'reporter' })
    }

    await sendIssueUpdatedEvent({
      issue: { id: issue.id, key: issue.key, title: issue.title },
      actor: { id: actor.id, name: actor.full_name ?? actor.email, email: actor.email },
      changes,
      recipients,
      projectId,
    })
  } catch (err) {
    console.error('[fireIssueUpdatedEvent]', err)
  }
}

type IssuePrevious = {
  title: string
  description: string | null
  status: string
  priority: string
  type: string
  due_date: string | null
  start_date: string | null
  sprint_id: string | null
  epic_id: string | null
  pause_reason: string | null
} | null

function detectChanges(
  previous: IssuePrevious,
  data: IssueUpdate,
  current: Issue,
): { field: string; from: string | null; to: string | null }[] {
  if (!previous) return []
  const changes: { field: string; from: string | null; to: string | null }[] = []
  const fields: { key: keyof IssueUpdate; label: string }[] = [
    { key: 'description', label: 'Description' },
    { key: 'priority', label: 'Priority' },
    { key: 'type', label: 'Type' },
    { key: 'due_date', label: 'Due date' },
    { key: 'sprint_id', label: 'Sprint' },
    { key: 'pause_reason', label: 'Pause reason' },
  ]
  for (const { key, label } of fields) {
    if (data[key] === undefined) continue
    const prevVal = (previous as Record<string, unknown>)[key] ?? null
    const newVal = (current as unknown as Record<string, unknown>)[key] ?? null
    if (prevVal !== newVal) {
      changes.push({
        field: label,
        from: prevVal == null ? null : String(prevVal),
        to: newVal == null ? null : String(newVal),
      })
    }
  }
  return changes
}

async function resolveSprintNames(
  supabase: AdminClient,
  changes: { field: string; from: string | null; to: string | null }[],
) {
  const sprintChange = changes.find((c) => c.field === 'Sprint')
  if (!sprintChange) return
  const ids = [sprintChange.from, sprintChange.to].filter((id): id is string => !!id)
  if (ids.length === 0) return
  const { data: sprints } = await supabase.from('sprints').select('id, name').in('id', ids)
  const nameById = new Map((sprints ?? []).map((s) => [s.id, s.name]))
  sprintChange.from = sprintChange.from ? (nameById.get(sprintChange.from) ?? sprintChange.from) : null
  sprintChange.to = sprintChange.to ? (nameById.get(sprintChange.to) ?? sprintChange.to) : null
}
