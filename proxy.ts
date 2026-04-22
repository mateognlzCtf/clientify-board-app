/**
 * proxy.ts — equivalente de middleware.ts en Next.js 16.
 *
 * Se ejecuta antes de cada petición. Su trabajo:
 * 1. Refrescar la sesión de Supabase (actualizar cookies de auth)
 * 2. Redirigir usuarios no autenticados que intenten acceder al dashboard
 * 3. Redirigir usuarios autenticados que vayan a /login o /register
 * 4. Bloquear usuarios con status 'pending' o 'suspended'
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isAuthRoute =
    pathname.startsWith('/login') || pathname.startsWith('/register')

  // Pages that blocked users are allowed to visit
  const isStatusGate =
    pathname.startsWith('/pending-approval') ||
    pathname.startsWith('/suspended') ||
    pathname.startsWith('/rejected') ||
    pathname.startsWith('/accept-platform-invite')

  // Pages that work without auth (token-based)
  const isPublicAction = pathname.startsWith('/admin-action')

  if (!user && !isAuthRoute && !isPublicAction && pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Check profile status for authenticated users
  if (user && !isAuthRoute && !isPublicAction) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single()

    if (isStatusGate) {
      // If user is on a status gate page but their status is now active, let them in
      if (profile?.status === 'active') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    } else {
      if (profile?.status === 'pending') {
        const url = request.nextUrl.clone()
        url.pathname = '/pending-approval'
        return NextResponse.redirect(url)
      }

      if (profile?.status === 'suspended') {
        const url = request.nextUrl.clone()
        url.pathname = '/suspended'
        return NextResponse.redirect(url)
      }

      if (profile?.status === 'rejected') {
        const url = request.nextUrl.clone()
        url.pathname = '/rejected'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
