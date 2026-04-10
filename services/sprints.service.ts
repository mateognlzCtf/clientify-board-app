import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { ServiceResult } from '@/types/common.types'
import type { Sprint, SprintCreate, SprintUpdate } from '@/types/sprint.types'

type Client = SupabaseClient<Database>

export async function getSprints(
  supabase: Client,
  projectId: string
): Promise<ServiceResult<Sprint[]>> {
  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('project_id', projectId)
    .neq('status', 'completed')
    .order('created_at', { ascending: true })

  if (error) return { data: null, error: 'Error loading sprints.' }
  return { data: data as Sprint[], error: null }
}

export async function createSprint(
  supabase: Client,
  data: SprintCreate
): Promise<ServiceResult<Sprint>> {
  const { data: result, error } = await supabase
    .from('sprints')
    .insert({
      project_id: data.project_id,
      name: data.name.trim(),
      goal: data.goal?.trim() || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[createSprint]', error)
    return { data: null, error: 'Error creating sprint.' }
  }
  return { data: result as Sprint, error: null }
}

export async function updateSprint(
  supabase: Client,
  sprintId: string,
  data: SprintUpdate
): Promise<ServiceResult<Sprint>> {
  const { data: result, error } = await supabase
    .from('sprints')
    .update({
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.goal !== undefined && { goal: data.goal?.trim() || null }),
      ...(data.start_date !== undefined && { start_date: data.start_date || null }),
      ...(data.end_date !== undefined && { end_date: data.end_date || null }),
    })
    .eq('id', sprintId)
    .select()
    .single()

  if (error) return { data: null, error: 'Error updating sprint.' }
  return { data: result as Sprint, error: null }
}

export async function deleteSprint(
  supabase: Client,
  sprintId: string
): Promise<ServiceResult<null>> {
  // Move issues in this sprint back to backlog
  await supabase
    .from('issues')
    .update({ sprint_id: null })
    .eq('sprint_id', sprintId)

  const { error } = await supabase.from('sprints').delete().eq('id', sprintId)
  if (error) return { data: null, error: 'Error deleting sprint.' }
  return { data: null, error: null }
}

export async function startSprint(
  supabase: Client,
  sprintId: string,
  projectId: string
): Promise<ServiceResult<Sprint>> {
  // Validate: only one active sprint per project
  const { data: active } = await supabase
    .from('sprints')
    .select('id')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .maybeSingle()

  if (active) {
    return { data: null, error: 'There is already an active sprint. Complete it before starting a new one.' }
  }

  const { data: result, error } = await supabase
    .from('sprints')
    .update({ status: 'active' })
    .eq('id', sprintId)
    .select()
    .single()

  if (error) return { data: null, error: 'Error starting sprint.' }
  return { data: result as Sprint, error: null }
}

export async function completeSprint(
  supabase: Client,
  sprintId: string,
  moveToSprintId: string | null   // null = move to backlog
): Promise<ServiceResult<null>> {
  // Move incomplete issues
  const { error: moveError } = await supabase
    .from('issues')
    .update({ sprint_id: moveToSprintId })
    .eq('sprint_id', sprintId)
    .neq('status', 'done')

  if (moveError) return { data: null, error: 'Error moving incomplete issues.' }

  // Mark sprint completed
  const { error } = await supabase
    .from('sprints')
    .update({ status: 'completed' })
    .eq('id', sprintId)

  if (error) return { data: null, error: 'Error completing sprint.' }
  return { data: null, error: null }
}
