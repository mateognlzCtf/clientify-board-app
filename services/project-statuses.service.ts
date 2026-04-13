import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceResult } from '@/types/common.types'
import type { ProjectStatus } from '@/types/project-settings.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export async function getProjectStatuses(supabase: Client, projectId: string): Promise<ServiceResult<ProjectStatus[]>> {
  const { data, error } = await supabase
    .from('project_statuses')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true })
  if (error) return { data: null, error: 'Error loading statuses.' }
  return { data: data as ProjectStatus[], error: null }
}

export async function createProjectStatus(
  supabase: Client,
  projectId: string,
  name: string,
  color: string,
  position: number,
  requiresPauseReason = false,
): Promise<ServiceResult<ProjectStatus>> {
  const { data, error } = await supabase
    .from('project_statuses')
    .insert({ project_id: projectId, name: name.trim(), color, position, requires_pause_reason: requiresPauseReason })
    .select()
    .single()
  if (error) return { data: null, error: 'Error creating status.' }
  return { data: data as ProjectStatus, error: null }
}

export async function updateProjectStatus(
  supabase: Client,
  id: string,
  updates: { name?: string; color?: string; position?: number; requires_pause_reason?: boolean },
): Promise<ServiceResult<ProjectStatus>> {
  const { data, error } = await supabase
    .from('project_statuses')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return { data: null, error: 'Error updating status.' }
  return { data: data as ProjectStatus, error: null }
}

export async function deleteProjectStatus(supabase: Client, id: string): Promise<ServiceResult<null>> {
  const { error } = await supabase.from('project_statuses').delete().eq('id', id)
  if (error) return { data: null, error: 'Error deleting status.' }
  return { data: null, error: null }
}
