'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignIn() {
  const router = useRouter()
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
      let result

      if (isSignUp) {
        result = await supabase.auth.signUp({ email, password })
        if (result.error) throw result.error
        setError('Check your email for confirmation link')
      } else {
        result = await supabase.auth.signInWithPassword({ email, password })
        if (result.error) throw result.error
        router.push('/dashboard')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Auth error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div
        style={{
          maxWidth: '400px',
          margin: '2rem auto',
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          {isSignUp ? 'Create Account' : 'Sign In'}
        </h2>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          {isSignUp ? 'Already have an account? ' : 'No account? '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
            }}
            style={{
              background: 'none',
              color: '#0066cc',
              padding: 0,
              textDecoration: 'underline',
              cursor: 'pointer',
              border: 'none',
              font: 'inherit',
            }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}
