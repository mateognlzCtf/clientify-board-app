'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const params = new URLSearchParams(hash)

    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token') ?? ''
    const type = params.get('type')
    const errorCode = params.get('error_code')

    if (errorCode || !accessToken) {
      router.replace('/login')
      return
    }

    const supabase = createClient()
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
