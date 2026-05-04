'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createProjectStatus, updateProjectStatus, deleteProjectStatus,
} from '@/services/project-statuses.service'
import {
  createProjectType, updateProjectType, deleteProjectType,
} from '@/services/project-types.service'
import {
  createEpic, updateEpic, deleteEpic,
} from '@/services/epics.service'
import {
  createProjectLabel, updateProjectLabel, deleteProjectLabel,
} from '@/services/project-labels.service'
import { deleteProject } from '@/services/projects.service'
import type { ServiceResult } from '@/types/common.types'
import type { ProjectStatus, ProjectIssueType, ProjectLabel } from '@/types/project-settings.types'
import type { Epic } from '@/types/epic.types'

async function requireOwner(projectId: string) {
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) redirect('/login')
  const { data } = await ssrClient
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (data?.role !== 'owner') return { error: 'Only the project owner can do this.', user: null }
  return { error: null, user }
}

async function requireManager(projectId: string) {
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) redirect('/login')

  const isSuperAdmin = process.env.PLATFORM_ADMIN_EMAILS?.split(',')
    .map((e) => e.trim())
    .includes(user.email ?? '') ?? false
  if (isSuperAdmin) return { error: null, user }

  const { data } = await ssrClient
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (data?.role !== 'owner' && data?.role !== 'admin') {
    return { error: 'Only the project owner or admin can do this.', user: null }
  }
  return { error: null, user }
}

function revalidateProject(projectId: string) {
  revalidatePath(`/project/${projectId}/settings`)
  revalidatePath(`/project/${projectId}/backlog`)
  revalidatePath(`/project/${projectId}/board`)
  revalidatePath(`/project/${projectId}/list`)
}

// ── EPICS ────────────────────────────────────────────────────────────────────

export async function createEpicSettingsAction(
  projectId: string, name: string, color: string,
): Promise<ServiceResult<Epic>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  const result = await createEpic(supabase, { project_id: projectId, name, color })
  if (!result.error) revalidateProject(projectId)
  return result
}

export async function updateEpicSettingsAction(
  projectId: string, epicId: string, name: string, color: string,
): Promise<ServiceResult<Epic>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  const result = await updateEpic(supabase, epicId, { name, color })
  if (!result.error) revalidateProject(projectId)
  return result
}

export async function deleteEpicSettingsAction(
  projectId: string, epicId: string,
): Promise<ServiceResult<null>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  const result = await deleteEpic(supabase, epicId)
  if (!result.error) revalidateProject(projectId)
  return result
}

// ── STATUSES ─────────────────────────────────────────────────────────────────

export async function createStatusAction(
  projectId: string, name: string, color: string, position: number, requiresPauseReason = false,
): Promise<ServiceResult<ProjectStatus>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  const result = await createProjectStatus(supabase, projectId, name, color, position, requiresPauseReason)
  if (!result.error) revalidateProject(projectId)
  return result
}

export async function updateStatusAction(
  projectId: string, id: string, name: string, color: string, requiresPauseReason?: boolean, isCompleted?: boolean,
): Promise<ServiceResult<ProjectStatus>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  const updates: { name: string; color: string; requires_pause_reason?: boolean; is_completed?: boolean } = { name, color }
  if (requiresPauseReason !== undefined) updates.requires_pause_reason = requiresPauseReason
  if (isCompleted !== undefined) updates.is_completed = isCompleted
  const result = await updateProjectStatus(supabase, id, updates)
  if (!result.error) revalidateProject(projectId)
  return result
}

export async function deleteStatusAction(
  projectId: string, id: string,
): Promise<ServiceResult<null>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  const result = await deleteProjectStatus(supabase, id)
  if (!result.error) revalidateProject(projectId)
  return result
}

export async function reorderStatusesAction(
  projectId: string, updates: { id: string; position: number }[],
): Promise<ServiceResult<null>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  await Promise.all(updates.map(({ id, position }) =>
    supabase.from('project_statuses').update({ position }).eq('id', id)
  ))
  revalidateProject(projectId)
  return { data: null, error: null }
}

// ── TYPES ────────────────────────────────────────────────────────────────────

export async function createTypeAction(
  projectId: string, name: string, color: string, position: number,
): Promise<ServiceResult<ProjectIssueType>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  const result = await createProjectType(supabase, projectId, name, color, position)
  if (!result.error) revalidateProject(projectId)
  return result
}

export async function updateTypeAction(
  projectId: string, id: string, name: string, color: string,
): Promise<ServiceResult<ProjectIssueType>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  const result = await updateProjectType(supabase, id, { name, color })
  if (!result.error) revalidateProject(projectId)
  return result
}

export async function deleteTypeAction(
  projectId: string, id: string,
): Promise<ServiceResult<null>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  const result = await deleteProjectType(supabase, id)
  if (!result.error) revalidateProject(projectId)
  return result
}

export async function reorderTypesAction(
  projectId: string, updates: { id: string; position: number }[],
): Promise<ServiceResult<null>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  await Promise.all(updates.map(({ id, position }) =>
    supabase.from('project_issue_types').update({ position }).eq('id', id)
  ))
  revalidateProject(projectId)
  return { data: null, error: null }
}

// ── LABELS ───────────────────────────────────────────────────────────────────

export async function createLabelAction(
  projectId: string, name: string, color: string,
): Promise<ServiceResult<ProjectLabel>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  const result = await createProjectLabel(supabase, projectId, name, color)
  if (!result.error) revalidateProject(projectId)
  return result
}

export async function updateLabelAction(
  projectId: string, id: string, name: string, color: string,
): Promise<ServiceResult<ProjectLabel>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  const result = await updateProjectLabel(supabase, id, { name, color })
  if (!result.error) revalidateProject(projectId)
  return result
}

export async function deleteLabelAction(
  projectId: string, id: string,
): Promise<ServiceResult<null>> {
  const { error } = await requireManager(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  const result = await deleteProjectLabel(supabase, id)
  if (!result.error) revalidateProject(projectId)
  return result
}

// ── PROJECT ───────────────────────────────────────────────────────────────────

export async function deleteProjectSettingsAction(
  projectId: string,
): Promise<ServiceResult<null>> {
  const { error } = await requireOwner(projectId)
  if (error) return { data: null, error }
  const supabase = createAdminClient()
  const result = await deleteProject(supabase, projectId)
  if (!result.error) {
    revalidatePath('/dashboard')
    revalidatePath('/', 'layout')
  }
  return result
}
