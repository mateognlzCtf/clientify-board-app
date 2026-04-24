'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.slice(1))

    const code = searchParams.get('code')
    const inviteToken = searchParams.get('inviteToken')
    const errorCode = hashParams.get('error_code') || searchParams.get('error')

    if (errorCode) {
      router.replace('/login')
      return
    }

    const supabase = createClient()

    // PKCE flow — email confirmation
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) { router.replace('/login'); return }
          if (inviteToken) {
            router.replace(`/accept-invite?token=${inviteToken}`)
          } else {
            router.replace('/dashboard')
          }
        })
        .catch(() => router.replace('/login'))
      return
    }

    // Hash flow — password recovery
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token') ?? ''
    const type = hashParams.get('type')

    if (!accessToken) {
      router.replace('/login')
      return
    }

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(() => {
        if (type === 'recovery') {
          router.replace('/reset-password')
        } else {
          router.replace('/dashboard')
        }
      })
      .catch(() => router.replace('/login'))
  }, [router])

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
      <p className="text-sm text-gray-500">Processing...</p>
    </div>
  )
}
