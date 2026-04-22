'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setPendingAndNotifyAction } from './actions'

export default function EmailConfirmedPage() {
  const [status, setStatus] = useState<'loading' | 'pending' | 'error'>('loading')
  const processed = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    async function process(userId: string, fullName: string, email: string) {
      if (processed.current) return
      processed.current = true
      try {
        await setPendingAndNotifyAction(userId, fullName, email)
        setStatus('pending')
      } catch {
        setStatus('error')
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        const u = session.user
        void process(u.id, u.user_metadata?.full_name ?? '', u.email ?? '')
      }
    })

    // Check if session already exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user
        void process(u.id, u.user_metadata?.full_name ?? '', u.email ?? '')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (status === 'loading') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 mb-4">
          <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Confirming your email...</h2>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-500">Please try again or contact the administrator.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-yellow-50 mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Email confirmed!</h2>
      <p className="text-sm text-gray-500 max-w-sm mx-auto">
        Your account is waiting for administrator approval. You will receive an email once your access has been granted.
      </p>
    </div>
  )
}
