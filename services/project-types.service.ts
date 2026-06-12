import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceResult } from '@/types/common.types'
import type { ProjectIssueType } from '@/types/project-settings.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export async function getProjectTypes(supabase: Client, projectId: string): Promise<ServiceResult<ProjectIssueType[]>> {
  const { data, error } = await supabase
    .from('project_issue_types')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true })
  if (error) return { data: null, error: 'Error loading types.' }
  return { data: data as ProjectIssueType[], error: null }
}

export async function createProjectType(
  supabase: Client,
  projectId: string,
  name: string,
  color: string,
  position: number,
): Promise<ServiceResult<ProjectIssueType>> {
  const { data, error } = await supabase
    .from('project_issue_types')
    .insert({ project_id: projectId, name: name.trim(), color, position })
    .select()
    .single()
  if (error) return { data: null, error: 'Error creating type.' }
  return { data: data as ProjectIssueType, error: null }
}

export async function updateProjectType(
  supabase: Client,
  id: string,
  updates: { name?: string; color?: string; position?: number },
): Promise<ServiceResult<ProjectIssueType>> {
  // If the name is changing, capture the old value first so we can backfill
  // issues that reference it by name (issues.type is plain text, no FK).
  let oldName: string | null = null
  let projectId: string | null = null
  if (updates.name !== undefined) {
    const { data: current } = await supabase
      .from('project_issue_types')
      .select('name, project_id')
      .eq('id', id)
      .single()
    if (current) {
      oldName = (current as { name: string }).name
      projectId = (current as { project_id: string }).project_id
    }
  }

  const { data, error } = await supabase
    .from('project_issue_types')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return { data: null, error: 'Error updating type.' }

  if (updates.name !== undefined && oldName && projectId && oldName !== updates.name) {
    await supabase
      .from('issues')
      .update({ type: updates.name })
      .eq('project_id', projectId)
      .eq('type', oldName)
  }

  return { data: data as ProjectIssueType, error: null }
}

export async function deleteProjectType(supabase: Client, id: string): Promise<ServiceResult<null>> {
  const { error } = await supabase.from('project_issue_types').delete().eq('id', id)
  if (error) return { data: null, error: 'Error deleting type.' }
  return { data: null, error: null }
}
