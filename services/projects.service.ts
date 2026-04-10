/**
 * projects.service.ts — capa de acceso a datos para proyectos.
 *
 * Principio D de SOLID: los componentes y hooks no conocen Supabase directamente.
 * Dependen de estas funciones. Si cambiamos el backend, solo modificamos este archivo.
 *
 * Todas las funciones devuelven ServiceResult<T> para manejo uniforme de errores.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { ServiceResult } from '@/types/common.types'
import type { Project, ProjectCreate, ProjectUpdate } from '@/types/project.types'
import type { MemberRole } from '@/types/member.types'

type Client = SupabaseClient<Database>

export interface ProjectMemberPreview {
  id: string
  user_id: string
  role: MemberRole
  profile: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface ProjectWithMembers extends Project {
  members: ProjectMemberPreview[]
  open_issue_count: number
}

/**
 * Obtiene todos los proyectos del usuario con sus miembros y conteo de issues abiertos.
 * Usa 3 queries separadas para evitar ambigüedad en joins anidados: project_members
 * tiene dos FK a profiles (user_id e invited_by), lo que confunde a PostgREST.
 */
export async function getProjects(
  supabase: Client
): Promise<ServiceResult<ProjectWithMembers[]>> {
  // 1. Proyectos (RLS filtra automáticamente los del usuario)
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (projectsError) {
    return { data: null, error: 'Error al cargar los proyectos.' }
  }

  if (!projectsData || projectsData.length === 0) {
    return { data: [], error: null }
  }

  const projectIds = projectsData.map((p) => p.id)

  // 2. Miembros con perfil — usamos FK hint explícito para evitar ambigüedad
  const { data: membersData, error: membersError } = await supabase
    .from('project_members')
    .select('id, project_id, user_id, role, profile:profiles!project_members_user_id_fkey(id, full_name, avatar_url)')
    .in('project_id', projectIds)

  if (membersError) {
    return { data: null, error: 'Error al cargar los miembros.' }
  }

  // 3. Issues abiertas (status != done)
  const { data: openIssues } = await supabase
    .from('issues')
    .select('project_id')
    .in('project_id', projectIds)
    .neq('status', 'done')

  // Agrupar miembros por proyecto
  type RawMember = { id: string; project_id: string; user_id: string; role: string; profile: { id: string; full_name: string | null; avatar_url: string | null } | null }

  const membersByProject = (membersData ?? []).reduce<Record<string, ProjectMemberPreview[]>>(
    (acc, m) => {
      const raw = m as unknown as RawMember
      if (!acc[raw.project_id]) acc[raw.project_id] = []
      acc[raw.project_id].push({
        id: raw.id,
        user_id: raw.user_id,
        role: raw.role as MemberRole,
        profile: raw.profile,
      })
      return acc
    },
    {}
  )

  // Contar issues abiertas por proyecto
  const openCountByProject = (openIssues ?? []).reduce<Record<string, number>>(
    (acc, issue) => {
      acc[issue.project_id] = (acc[issue.project_id] ?? 0) + 1
      return acc
    },
    {}
  )

  // Combinar todo
  const projects: ProjectWithMembers[] = projectsData.map((p) => ({
    ...(p as unknown as Project),
    members: membersByProject[p.id] ?? [],
    open_issue_count: openCountByProject[p.id] ?? 0,
  }))

  return { data: projects, error: null }
}

/**
 * Obtiene los miembros de un proyecto con sus perfiles.
 */
export async function getProjectMembers(
  supabase: Client,
  projectId: string
): Promise<ServiceResult<ProjectMemberPreview[]>> {
  const { data, error } = await supabase
    .from('project_members')
    .select('id, user_id, role, profile:profiles!project_members_user_id_fkey(id, full_name, avatar_url)')
    .eq('project_id', projectId)

  if (error) {
    return { data: null, error: 'Error al cargar los miembros.' }
  }

  type RawMember = { id: string; user_id: string; role: string; profile: { id: string; full_name: string | null; avatar_url: string | null } | null }

  const members: ProjectMemberPreview[] = (data as unknown as RawMember[]).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role as MemberRole,
    profile: m.profile,
  }))

  return { data: members, error: null }
}

/**
 * Obtiene un proyecto por ID. RLS garantiza que solo el usuario puede ver sus proyectos.
 */
export async function getProject(
  supabase: Client,
  projectId: string
): Promise<ServiceResult<Project>> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (error) {
    return { data: null, error: 'Proyecto no encontrado.' }
  }

  return { data: data as Project, error: null }
}

/**
 * Crea un nuevo proyecto. El trigger handle_new_project() agrega automáticamente
 * al creador como owner en project_members e inicializa la secuencia de issues.
 */
export async function createProject(
  supabase: Client,
  userId: string,
  project: ProjectCreate
): Promise<ServiceResult<Project>> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: project.name.trim(),
      key: project.key.trim().toUpperCase(),
      description: project.description?.trim() || null,
      owner_id: userId,
    })
    .select()
    .single()

  if (error) {
    console.error('[createProject] Supabase error:', error)
    if (error.code === '23505') {
      return { data: null, error: 'Ya existe un proyecto con esa clave. Elige otra.' }
    }
    if (error.code === '23503') {
      return { data: null, error: 'Tu perfil de usuario no existe. Intenta cerrar sesión y volver a entrar.' }
    }
    return { data: null, error: `Error al crear el proyecto: ${error.message}` }
  }

  return { data: data as Project, error: null }
}

/**
 * Actualiza nombre y/o descripción de un proyecto.
 * La clave (key) no se puede cambiar una vez creado el proyecto.
 */
export async function updateProject(
  supabase: Client,
  projectId: string,
  update: ProjectUpdate
): Promise<ServiceResult<Project>> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...(update.name !== undefined && { name: update.name.trim() }),
      ...(update.description !== undefined && {
        description: update.description?.trim() || null,
      }),
    })
    .eq('id', projectId)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Error al actualizar el proyecto.' }
  }

  return { data: data as Project, error: null }
}

/**
 * Elimina un proyecto. Solo el owner puede hacerlo (RLS lo garantiza).
 * ON DELETE CASCADE elimina members, issues, comments y attachments.
 */
export async function deleteProject(
  supabase: Client,
  projectId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId)

  if (error) {
    return { data: null, error: 'Error al eliminar el proyecto.' }
  }

  return { data: null, error: null }
}
