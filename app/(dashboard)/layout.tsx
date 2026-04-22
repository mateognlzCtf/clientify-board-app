import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import type { UserProfile } from '@/types/auth.types'

/**
 * DashboardLayout — layout protegido que envuelve todas las páginas del dashboard.
 *
 * Responsabilidades:
 * 1. Verificar que hay sesión activa (segunda capa de seguridad además del proxy.ts)
 * 2. Cargar el perfil del usuario y sus proyectos en paralelo
 * 3. Renderizar Sidebar + Navbar con esos datos
 *
 * Al ser un Server Component, los datos se obtienen en el servidor.
 * El Sidebar y el Navbar son Client Components que reciben los datos como props.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Cargamos perfil y proyectos del usuario en paralelo para mejor rendimiento
  const [profileResult, membersResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('project_members')
      .select('project_id, role')
      .eq('user_id', user.id),
  ])

  const profile = profileResult.data as UserProfile | null

  // Obtener los proyectos a partir de los IDs de membresía
  const memberRows = (membersResult.data ?? []) as Array<{ project_id: string; role: string }>
  const projectIds = memberRows.map((m) => m.project_id)
  const ownerProjectIds = memberRows.filter((m) => m.role === 'owner').map((m) => m.project_id)

  const { data: projects } =
    projectIds.length > 0
      ? await supabase
          .from('projects')
          .select('id, name, key')
          .in('id', projectIds)
          .order('name')
      : { data: [] }

  const projectList = (projects ?? []) as Array<{
    id: string
    name: string
    key: string
  }>

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar projects={projectList} ownerProjectIds={ownerProjectIds} />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Navbar profile={profile} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
