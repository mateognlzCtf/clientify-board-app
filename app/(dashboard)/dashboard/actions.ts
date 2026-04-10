'use server'

/**
 * Server Actions para el dashboard de proyectos.
 *
 * Patrón de seguridad:
 * 1. Verificamos la identidad del usuario con el cliente SSR (cookies).
 * 2. Ejecutamos las mutaciones con el cliente admin (service_role key).
 *    El cliente admin bypasa RLS — la autorización la hacemos nosotros
 *    verificando que el usuario sea el owner antes de cada operación.
 *
 * La service_role key vive en SUPABASE_SERVICE_ROLE_KEY (sin NEXT_PUBLIC_),
 * nunca llega al browser.
 */
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createProject as createProjectService,
  updateProject as updateProjectService,
  deleteProject as deleteProjectService,
} from '@/services/projects.service'
import type { ProjectCreate, ProjectUpdate } from '@/types/project.types'
import type { ServiceResult } from '@/types/common.types'
import type { Project } from '@/types/project.types'

async function getAuthenticatedUser() {
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) redirect('/login')
  return user
}

export async function createProjectAction(
  data: ProjectCreate
): Promise<ServiceResult<Project>> {
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()
  const result = await createProjectService(supabase, user.id, data)

  if (!result.error) {
    revalidatePath('/dashboard')
  }

  return result
}

export async function updateProjectAction(
  projectId: string,
  data: ProjectUpdate
): Promise<ServiceResult<Project>> {
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()

  // Verificar que el usuario es owner antes de actualizar
  const { data: membership, error: memberError } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (memberError || !membership || membership.role !== 'owner') {
    return { data: null, error: 'No tienes permiso para editar este proyecto.' }
  }

  const result = await updateProjectService(supabase, projectId, data)

  if (!result.error) {
    revalidatePath('/dashboard')
  }

  return result
}

export async function deleteProjectAction(
  projectId: string
): Promise<ServiceResult<null>> {
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()

  // Verificar que el usuario es owner antes de eliminar
  const { data: membership, error: memberError } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (memberError || !membership || membership.role !== 'owner') {
    return { data: null, error: 'Solo el owner puede eliminar el proyecto.' }
  }

  const result = await deleteProjectService(supabase, projectId)

  if (!result.error) {
    revalidatePath('/dashboard')
  }

  return result
}
