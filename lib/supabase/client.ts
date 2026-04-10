import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

/**
 * Singleton del cliente Supabase para el browser.
 *
 * React StrictMode monta los componentes dos veces en desarrollo,
 * lo que provoca que createBrowserClient() cree múltiples instancias
 * que compiten por el auth lock → "Lock was released because another request stole it".
 *
 * La solución es guardar la instancia en una variable de módulo y reutilizarla.
 * En el servidor nunca se usa este archivo (usar lib/supabase/server.ts).
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createClient() {
  if (browserClient) return browserClient

  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return browserClient
}
