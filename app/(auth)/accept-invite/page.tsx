import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getInvitationByToken, acceptInvitation } from '@/services/members.service'
import { revalidatePath } from 'next/cache'

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function AcceptInvitePage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    return <ErrorCard message="Enlace de invitación inválido o incompleto." />
  }

  const adminSupabase = createAdminClient()
  const { data: invitation, error } = await getInvitationByToken(adminSupabase, token)

  if (error || !invitation) {
    return <ErrorCard message="La invitación no existe o ya no es válida." />
  }

  if (invitation.accepted_at) {
    return <ErrorCard message="Esta invitación ya fue aceptada anteriormente." />
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return <ErrorCard message="Esta invitación ha expirado. Pide al administrador del proyecto que te envíe una nueva." />
  }

  const projectName = invitation.project?.name ?? 'un proyecto'
  const inviterName = invitation.inviter?.full_name ?? 'Alguien'

  // Check if user is authenticated
  const ssrSupabase = await createClient()
  const { data: { user } } = await ssrSupabase.auth.getUser()

  if (user) {
    if (!user.email) return <ErrorCard message="Tu cuenta no tiene email asociado. Contacta al administrador." />
    // User is logged in → accept and redirect
    const result = await acceptInvitation(adminSupabase, token, user.id, user.email)

    if (result.error) {
      return <ErrorCard message={result.error} />
    }

    revalidatePath(`/project/${result.data!.projectId}/members`)
    redirect(`/project/${result.data!.projectId}/board`)
  }

  // Not logged in → show invitation details
  const registerUrl = `/register?inviteToken=${token}&email=${encodeURIComponent(invitation.email)}`
  const loginUrl = `/login?inviteToken=${token}&email=${encodeURIComponent(invitation.email)}`

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="mb-6 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Tienes una invitación</h2>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm text-gray-700 space-y-1">
        <p><span className="text-gray-400">De:</span> <strong>{inviterName}</strong></p>
        <p><span className="text-gray-400">Proyecto:</span> <strong>{projectName}</strong></p>
        <p><span className="text-gray-400">Para:</span> <strong>{invitation.email}</strong></p>
        <p><span className="text-gray-400">Rol:</span> <strong className="capitalize">{invitation.role}</strong></p>
      </div>

      <div className="space-y-3">
        <Link
          href={registerUrl}
          className="block w-full text-center py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg
                     hover:bg-blue-700 transition-colors"
        >
          Crear cuenta y aceptar
        </Link>
        <Link
          href={loginUrl}
          className="block w-full text-center py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg
                     hover:bg-gray-50 transition-colors"
        >
          Ya tengo cuenta — Iniciar sesión
        </Link>
      </div>

      <p className="mt-5 text-center text-xs text-gray-400">
        La invitación fue enviada a <strong>{invitation.email}</strong>.<br />
        Debes usar esa dirección de email para acceder.
      </p>
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50 mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Invitación no válida</h2>
      <p className="text-sm text-gray-500 mb-6">{message}</p>
      <Link
        href="/login"
        className="inline-block px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Ir al inicio de sesión
      </Link>
    </div>
  )
}
