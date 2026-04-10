import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * Cliente Supabase con service_role key.
 * Bypasa RLS — úsalo SOLO en Server Actions/Route Handlers del servidor,
 * NUNCA en Client Components ni con el prefijo NEXT_PUBLIC_.
 *
 * Siempre verifica manualmente la identidad del usuario antes de usarlo.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
