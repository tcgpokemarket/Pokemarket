'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const supabase = createClient()
      const { error } = await (supabase.from('leads') as any).insert({
        email,
        status: 'new'
      })

      if (error) throw error

      setMessage('✓ Thanks for your interest! We will be in touch soon.')
      setEmail('')
    } catch (error) {
      setMessage(
        'Error: ' +
          (error instanceof Error ? error.message : 'Failed to subscribe')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <div className="hero">
        <h2>🎮 Welcome to TCG Poke Market</h2>
        <p>The ultimate destination for Pokémon TCG cards</p>
        <p style={{ fontSize: '1rem', color: '#666' }}>
          We are building the future of Pokémon card trading. Join us!
        </p>
      </div>

      <div className="container">
        <div
          style={{
            maxWidth: '500px',
            margin: '0 auto',
            background: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ marginBottom: '1rem', textAlign: 'center' }}>
            Get Early Access
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Subscribing...' : 'Join Our Waitlist'}
            </button>
          </form>
          {message && (
            <p
              style={{
                marginTop: '1rem',
                textAlign: 'center',
                color: message.startsWith('✓') ? '#3c3' : '#c33',
              }}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
