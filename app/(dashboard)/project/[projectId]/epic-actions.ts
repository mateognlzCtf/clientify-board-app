'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import {
  getEpics as getEpicsService,
  createEpic as createEpicService,
  updateEpic as updateEpicService,
  deleteEpic as deleteEpicService,
} from '@/services/epics.service'
import type { EpicCreate, EpicUpdate } from '@/types/epic.types'
import type { ServiceResult } from '@/types/common.types'
import type { Epic } from '@/types/epic.types'

async function getAuthenticatedUser() {
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) redirect('/login')
  return user
}

export async function getEpicsAction(projectId: string): Promise<ServiceResult<Epic[]>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  return getEpicsService(supabase, projectId)
}

export async function createEpicAction(
  projectId: string,
  data: EpicCreate
): Promise<ServiceResult<Epic>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await createEpicService(supabase, data)
  if (!result.error) {
    revalidatePath(`/project/${projectId}/backlog`)
    revalidatePath(`/project/${projectId}/board`)
    revalidatePath(`/project/${projectId}/list`)
  }
  return result
}

export async function updateEpicAction(
  projectId: string,
  epicId: string,
  data: EpicUpdate
): Promise<ServiceResult<Epic>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await updateEpicService(supabase, epicId, data)
  if (!result.error) {
    revalidatePath(`/project/${projectId}/backlog`)
    revalidatePath(`/project/${projectId}/board`)
    revalidatePath(`/project/${projectId}/list`)
  }
  return result
}

export async function deleteEpicAction(
  projectId: string,
  epicId: string
): Promise<ServiceResult<null>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await deleteEpicService(supabase, epicId)
  if (!result.error) {
    revalidatePath(`/project/${projectId}/backlog`)
    revalidatePath(`/project/${projectId}/board`)
    revalidatePath(`/project/${projectId}/list`)
  }
  return result
}
