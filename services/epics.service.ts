import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { ServiceResult } from '@/types/common.types'
import type { Epic, EpicCreate, EpicUpdate } from '@/types/epic.types'

type Client = SupabaseClient<Database>

export async function getEpics(
  supabase: Client,
  projectId: string
): Promise<ServiceResult<Epic[]>> {
  const { data, error } = await supabase
    .from('epics')
    .select('*')
    .eq('project_id', projectId)
    .order('name', { ascending: true })

  if (error) return { data: null, error: 'Error loading epics.' }
  return { data: data as unknown as Epic[], error: null }
}

export async function createEpic(
  supabase: Client,
  data: EpicCreate
): Promise<ServiceResult<Epic>> {
  const { data: result, error } = await supabase
    .from('epics')
    .insert({
      project_id: data.project_id,
      name: data.name.trim(),
      color: data.color ?? '#6366f1',
    })
    .select()
    .single()

  if (error) return { data: null, error: 'Error creating epic.' }
  return { data: result as unknown as Epic, error: null }
}

export async function updateEpic(
  supabase: Client,
  epicId: string,
  data: EpicUpdate
): Promise<ServiceResult<Epic>> {
  const { data: result, error } = await supabase
    .from('epics')
    .update({
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.color !== undefined && { color: data.color }),
    })
    .eq('id', epicId)
    .select()
    .single()

  if (error) return { data: null, error: 'Error updating epic.' }
  return { data: result as unknown as Epic, error: null }
}

export async function deleteEpic(
  supabase: Client,
  epicId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.from('epics').delete().eq('id', epicId)
  if (error) return { data: null, error: 'Error deleting epic.' }
  return { data: null, error: null }
}
