'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignIn() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard'
  const callbackUrl = `/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()

      if (isSignUp) {
        const result = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl } })
        if (result.error) throw result.error
        router.push(callbackUrl)
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password })
        if (result.error) throw result.error
        router.push(redirectTo)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Auth error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
            Seller sign in
          </div>
          <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
            Sign in to manage your{' '}
            <span className="text-yellow-400">TcgPoké Market</span> store.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-gray-300">
            Access your listings, track orders, review live auction activity, and keep your store moving from one clean dashboard.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              'Branded seller dashboard',
              'Live auction controls',
              'Collector-first listing flow',
              'Fast access to support pages',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-yellow-400">Account access</p>
              <h2 className="mt-2 text-2xl font-black">{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
            </div>
            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-400">
              {isSignUp ? 'Join' : 'Sign in'}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-200">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-[#11111c] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-200">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-[#11111c] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-[#e22400] to-[#ffab01] px-4 py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Loading...' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-400">
            {isSignUp ? 'Already have an account? ' : 'New here? '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
              }}
              className="font-semibold text-yellow-400 hover:text-yellow-300"
            >
              {isSignUp ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
