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
import type { IssueCreate, IssueUpdate, Issue } from '@/types/issue.types'
import type { ServiceResult } from '@/types/common.types'
import {
  sendAssignmentNotification,
  sendStatusChangeNotification,
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

    // Notify assignee if different from creator
    if (result.data && data.assignee_id && data.assignee_id !== user.id) {
      void notifyAssignment({
        supabase,
        assigneeId: data.assignee_id,
        creatorId: user.id,
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
  const result = await updateIssueService(supabase, issueId, data)

  if (!result.error) {
    revalidatePath(`/project/${projectId}/list`)
    revalidatePath(`/project/${projectId}/backlog`)
    revalidatePath(`/project/${projectId}/board`)

    // Notify assignee on status change if different from updater
    if (result.data && data.status && result.data.assignee_id && result.data.assignee_id !== user.id) {
      void notifyStatusChange({
        supabase,
        assigneeId: result.data.assignee_id,
        updaterId: user.id,
        issue: result.data,
        projectId,
        newStatus: data.status,
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

// ── Email helpers ─────────────────────────────────────────────────────────────

async function notifyAssignment({
  supabase, assigneeId, creatorId, issue, projectId,
}: {
  supabase: ReturnType<typeof createAdminClient>
  assigneeId: string
  creatorId: string
  issue: Issue
  projectId: string
}) {
  try {
    const [{ data: assignee }, { data: creator }] = await Promise.all([
      supabase.from('profiles').select('email, full_name').eq('id', assigneeId).single(),
      supabase.from('profiles').select('full_name').eq('id', creatorId).single(),
    ])
    if (!assignee?.email) return
    await sendAssignmentNotification({
      toEmail: assignee.email,
      toName: assignee.full_name ?? assignee.email,
      assignedByName: creator?.full_name ?? 'Alguien',
      issueKey: issue.key,
      issueTitle: issue.title,
      projectId,
    })
  } catch (err) {
    console.error('[notifyAssignment]', err)
  }
}

async function notifyStatusChange({
  supabase, assigneeId, updaterId, issue, projectId, newStatus,
}: {
  supabase: ReturnType<typeof createAdminClient>
  assigneeId: string
  updaterId: string
  issue: Issue
  projectId: string
  newStatus: string
}) {
  try {
    const [{ data: assignee }, { data: updater }] = await Promise.all([
      supabase.from('profiles').select('email, full_name').eq('id', assigneeId).single(),
      supabase.from('profiles').select('full_name').eq('id', updaterId).single(),
    ])
    if (!assignee?.email) return
    await sendStatusChangeNotification({
      toEmail: assignee.email,
      toName: assignee.full_name ?? assignee.email,
      changedByName: updater?.full_name ?? 'Alguien',
      issueKey: issue.key,
      issueTitle: issue.title,
      newStatus,
      projectId,
    })
  } catch (err) {
    console.error('[notifyStatusChange]', err)
  }
}
