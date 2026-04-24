'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isValidEmail, isNonEmptyString, isValidPassword } from '@/lib/utils/validation'
import { registerStandardAction, validatePlatformInviteAction } from './registration-actions'

interface Props {
  inviteToken?: string
  defaultEmail?: string
  platformInviteToken?: string
}

export function RegisterClient({ inviteToken, defaultEmail, platformInviteToken }: Props) {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!isNonEmptyString(fullName)) {
      setError('Please enter your full name.')
      return
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    if (!isValidPassword(password)) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const supabase = createClient()

    try {
      // Platform invite: validate token server-side, then register via Supabase (sends confirmation email)
      if (platformInviteToken) {
        const result = await validatePlatformInviteAction(email, platformInviteToken)
        if (result.error) {
          setError(result.error)
          setLoading(false)
          return
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        })
        if (signUpError) {
          setError(signUpError.message.includes('already registered') || signUpError.message.includes('already been registered')
            ? 'An account with this email already exists.'
            : 'Error creating account. Please try again.')
          setLoading(false)
          return
        }
        setEmailSent(true)
        setLoading(false)
        return
      }

      // Project invite — same as platform invite but redirects to accept-invite after confirmation
      if (inviteToken) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?inviteToken=${inviteToken}`,
          },
        })
        if (signUpError) {
          setError(
            signUpError.message.includes('already registered') || signUpError.message.includes('already been registered')
              ? 'An account with this email already exists. Try signing in.'
              : 'Error creating account. Please try again.'
          )
          setLoading(false)
          return
        }
        setEmailSent(true)
        setLoading(false)
        return
      }

      // Standard registration — Supabase sends confirmation email
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })

      if (signUpError) {
        setError(signUpError.message.includes('already registered') || signUpError.message.includes('already been registered')
          ? 'An account with this email already exists.'
          : signUpError.message.includes('rate limit')
          ? 'Too many requests. Please try again in a few minutes.'
          : 'Error creating account. Please try again.')
        setLoading(false)
        return
      }

      setEmailSent(true)
      setLoading(false)
    } catch {
      setError('Error creating account. Please try again.')
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account and sign in.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Create account
      </h2>
      {(inviteToken || platformInviteToken) && (
        <p className="text-sm text-blue-600 mb-5">Create your account to accept the invitation.</p>
      )}

      <form onSubmit={handleSubmit} className={`space-y-4 ${!(inviteToken || platformInviteToken) ? 'mt-6' : ''}`} noValidate>
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-400"
            placeholder="John Smith"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            readOnly={!!defaultEmail}
            autoComplete="email"
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-400 ${defaultEmail ? 'bg-gray-50 text-gray-500' : ''}`}
            placeholder="you@email.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-400"
            placeholder="At least 6 characters"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg
                     hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed
                     transition-colors mt-2"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link
          href={
            inviteToken
              ? `/login?inviteToken=${inviteToken}&email=${encodeURIComponent(email)}`
              : platformInviteToken
              ? `/login?platformInviteToken=${platformInviteToken}&email=${encodeURIComponent(email)}`
              : '/login'
          }
          className="text-blue-600 font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
