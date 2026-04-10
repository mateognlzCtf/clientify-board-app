import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

/**
 * Cliente Supabase para usar en Server Components, Server Actions y Route Handlers.
 * Es async porque en Next.js 16 cookies() devuelve una Promise.
 *
 * El bloque try/catch en setAll es intencional: cuando se llama desde un
 * Server Component (no desde una Server Action), las cookies son de solo lectura.
 * El proxy.ts se encarga de refrescar la sesión en esos casos.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Llamado desde un Server Component — ignorar.
            // El proxy.ts refresca la sesión automáticamente.
          }
        },
      },
    }
  )
}
