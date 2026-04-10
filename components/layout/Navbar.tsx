'use client'

/**
 * Navbar — barra superior con info del usuario y botón de logout.
 *
 * Recibe el perfil desde el DashboardLayout (Server Component).
 * El logout llama directamente al cliente de Supabase y redirige a /login.
 */
import { useRouter } from 'next/navigation'
import { LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/types/auth.types'

interface NavbarProps {
  profile: UserProfile | null
  breadcrumb?: React.ReactNode
}

export function Navbar({ profile, breadcrumb }: NavbarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?'

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center px-5 gap-4 shrink-0">
      <div className="flex-1 min-w-0">
        {breadcrumb ?? null}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {profile?.full_name && (
          <span className="text-sm text-gray-600 hidden sm:block">
            {profile.full_name}
          </span>
        )}

        {/* Avatar */}
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name ?? 'Avatar'}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-gray-100"
          />
        ) : (
          <div
            className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center ring-2 ring-gray-100"
            aria-label="Avatar de usuario"
          >
            {initials !== '?' ? (
              <span className="text-white text-xs font-semibold">{initials}</span>
            ) : (
              <User size={14} className="text-white" />
            )}
          </div>
        )}

        <button
          onClick={handleLogout}
          className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
