'use server'

import { after } from 'next/server'
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
  sendIssueCreatedEvent,
  sendIssueUpdatedEvent,
  type EventChange,
  type EventRecipient,
  type RecipientRole,
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

    if (result.data && data.label_ids !== undefined) {
      await setIssueLabels(supabase, result.data.id, data.label_ids)
    }

    // Always fire issue.created so n8n receives the event (for Slack channel
    // posts, audit logs, etc.) even when the creator assigned the ticket to
    // themselves. recipients[] is empty in that case — n8n decides what to do.
    // after() keeps the Vercel function alive until the fetch completes.
    if (result.data) {
      const issue = result.data
      const assigneeId = data.assignee_id ?? null
      const creatorId = user.id
      after(async () => {
        try {
          const idsToFetch = assigneeId && assigneeId !== creatorId
            ? [creatorId, assigneeId]
            : [creatorId]
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', idsToFetch)
          const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
          const actor = profileById.get(creatorId)
          if (!actor?.email) return
          const recipients: EventRecipient[] = []
          if (assigneeId && assigneeId !== creatorId) {
            const r = profileById.get(assigneeId)
            if (r?.email) {
              recipients.push({
                id: r.id,
                name: r.full_name ?? r.email,
                email: r.email,
                role: 'assignee',
              })
            }
          }
          await sendIssueCreatedEvent({
            actor: { id: actor.id, name: actor.full_name ?? actor.email, email: actor.email },
            issue: { id: issue.id, key: issue.key, title: issue.title },
            recipients,
            projectId,
          })
        } catch (err) {
          console.error('[issue.created]', err)
        }
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

  // Fetch previous state before updating so we can detect what actually changed.
  const { data: previous } = await supabase
    .from('issues')
    .select('status, assignee_id, title, description, priority, type, due_date, start_date, sprint_id, epic_id, pause_reason')
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

    if (data.label_ids !== undefined) {
      await setIssueLabels(supabase, issueId, data.label_ids)
    }

    // Single consolidated webhook with actor + all changes + all recipients.
    // after() keeps the Vercel function alive until the fetch completes.
    const issue = result.data
    const updaterId = user.id
    after(async () => {
      try {
        const changes = await buildChanges(supabase, previous, data, issue)
        if (changes.length === 0) return

        // Recipients: assignee, reporter, previous assignee (on reassignment).
        // Actor never receives their own notification.
        const roleByRecipientId = new Map<string, RecipientRole>()
        if (issue.assignee_id && issue.assignee_id !== updaterId) {
          roleByRecipientId.set(issue.assignee_id, 'assignee')
        }
        if (
          previous?.assignee_id &&
          previous.assignee_id !== issue.assignee_id &&
          previous.assignee_id !== updaterId &&
          !roleByRecipientId.has(previous.assignee_id)
        ) {
          roleByRecipientId.set(previous.assignee_id, 'previousAssignee')
        }
        if (
          issue.reporter_id &&
          issue.reporter_id !== updaterId &&
          !roleByRecipientId.has(issue.reporter_id)
        ) {
          roleByRecipientId.set(issue.reporter_id, 'reporter')
        }

        // Fire even when recipients is empty (self-edit). n8n branches per
        // channel: skip email when empty, still post to Slack channel.
        const profileIds = [updaterId, ...roleByRecipientId.keys()]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', profileIds)
        const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
        const actorProfile = profileById.get(updaterId)
        if (!actorProfile?.email) return

        const recipients: EventRecipient[] = []
        for (const [id, role] of roleByRecipientId) {
          const p = profileById.get(id)
          if (!p?.email) continue
          recipients.push({
            id: p.id,
            name: p.full_name ?? p.email,
            email: p.email,
            role,
          })
        }

        await sendIssueUpdatedEvent({
          actor: {
            id: actorProfile.id,
            name: actorProfile.full_name ?? actorProfile.email,
            email: actorProfile.email,
          },
          issue: { id: issue.id, key: issue.key, title: issue.title },
          changes,
          recipients,
          projectId,
        })
      } catch (err) {
        console.error('[issue.updated]', err)
      }
    })
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

// ── Change detection ────────────────────────────────────────────────────────

type IssuePrevious = {
  status: string
  assignee_id: string | null
  title: string
  description: string | null
  priority: string
  type: string
  due_date: string | null
  start_date: string | null
  sprint_id: string | null
  epic_id: string | null
  pause_reason: string | null
} | null

async function buildChanges(
  supabase: ReturnType<typeof createAdminClient>,
  previous: IssuePrevious,
  data: IssueUpdate,
  current: Issue,
): Promise<EventChange[]> {
  if (!previous) return []
  const changes: EventChange[] = []

  // Status — was a separate event before, now consolidated
  if (data.status !== undefined && data.status !== previous.status) {
    changes.push({ field: 'Status', from: previous.status ?? null, to: data.status ?? null })
  }

  // Assignee — resolve UUIDs to display names
  if (data.assignee_id !== undefined && data.assignee_id !== previous.assignee_id) {
    const assigneeIds = [previous.assignee_id, data.assignee_id].filter((id): id is string => !!id)
    let nameById = new Map<string, string>()
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', assigneeIds)
      nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]))
    }
    changes.push({
      field: 'Assignee',
      from: previous.assignee_id ? (nameById.get(previous.assignee_id) ?? previous.assignee_id) : null,
      to: data.assignee_id ? (nameById.get(data.assignee_id) ?? data.assignee_id) : null,
    })
  }

  // Plain scalar fields
  const fields: { key: keyof IssueUpdate; label: string }[] = [
    { key: 'title', label: 'Title' },
    { key: 'description', label: 'Description' },
    { key: 'priority', label: 'Priority' },
    { key: 'type', label: 'Type' },
    { key: 'due_date', label: 'Due date' },
    { key: 'start_date', label: 'Start date' },
    { key: 'sprint_id', label: 'Sprint' },
    { key: 'epic_id', label: 'Epic' },
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

  // Resolve sprint IDs to names
  await resolveIdsToNames(supabase, changes, 'Sprint', 'sprints', 'name')
  // Resolve epic IDs to names
  await resolveIdsToNames(supabase, changes, 'Epic', 'epics', 'name')

  return changes
}

async function resolveIdsToNames(
  supabase: ReturnType<typeof createAdminClient>,
  changes: EventChange[],
  field: string,
  table: 'sprints' | 'epics',
  nameColumn: 'name',
) {
  const change = changes.find((c) => c.field === field)
  if (!change) return
  const ids = [change.from, change.to].filter((id): id is string => !!id)
  if (ids.length === 0) return
  const { data: rows } = await supabase.from(table).select(`id, ${nameColumn}`).in('id', ids)
  const nameById = new Map(((rows ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]))
  change.from = change.from ? (nameById.get(change.from) ?? change.from) : null
  change.to = change.to ? (nameById.get(change.to) ?? change.to) : null
}
