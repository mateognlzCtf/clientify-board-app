'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getSprints as getSprintsService,
  createSprint as createSprintService,
  updateSprint as updateSprintService,
  deleteSprint as deleteSprintService,
  startSprint as startSprintService,
  completeSprint as completeSprintService,
} from '@/services/sprints.service'
import type { SprintCreate, SprintUpdate, Sprint } from '@/types/sprint.types'
import type { ServiceResult } from '@/types/common.types'

async function getAuthenticatedUser() {
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) redirect('/login')
  return user
}

function revalidate(projectId: string) {
  revalidatePath(`/project/${projectId}/backlog`)
  revalidatePath(`/project/${projectId}/board`)
  revalidatePath(`/project/${projectId}/list`)
}

export async function getSprintsAction(
  projectId: string
): Promise<ServiceResult<Sprint[]>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  return getSprintsService(supabase, projectId)
}

export async function createSprintAction(
  projectId: string,
  data: SprintCreate
): Promise<ServiceResult<Sprint>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await createSprintService(supabase, data)
  if (!result.error) revalidate(projectId)
  return result
}

export async function updateSprintAction(
  projectId: string,
  sprintId: string,
  data: SprintUpdate
): Promise<ServiceResult<Sprint>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await updateSprintService(supabase, sprintId, data)
  if (!result.error) revalidate(projectId)
  return result
}

export async function deleteSprintAction(
  projectId: string,
  sprintId: string
): Promise<ServiceResult<null>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await deleteSprintService(supabase, sprintId)
  if (!result.error) revalidate(projectId)
  return result
}

export async function startSprintAction(
  projectId: string,
  sprintId: string
): Promise<ServiceResult<Sprint>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await startSprintService(supabase, sprintId, projectId)
  if (!result.error) revalidate(projectId)
  return result
}

export async function completeSprintAction(
  projectId: string,
  sprintId: string,
  moveToSprintId: string | null
): Promise<ServiceResult<null>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await completeSprintService(supabase, sprintId, moveToSprintId)
  if (!result.error) revalidate(projectId)
  return result
}
