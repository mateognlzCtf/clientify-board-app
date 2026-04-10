import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Página raíz: redirige al dashboard si hay sesión, o a /login si no.
 * La lógica real de protección está en proxy.ts, esto es solo para la raíz.
 */
export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
