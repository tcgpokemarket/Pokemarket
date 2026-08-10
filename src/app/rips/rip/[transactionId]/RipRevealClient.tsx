'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { RipResult } from '@/lib/rips'

type RevealState = 'idle' | 'revealing' | 'revealed' | 'error'
type ActionResult = { status: string } | null

interface Props {
  transactionId: string
  checkoutSessionId: string | null
}

export default function RipRevealClient({ transactionId, checkoutSessionId }: Props) {
  const [revealState, setRevealState] = useState<RevealState>('idle')
  const [result, setResult] = useState<RipResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<ActionResult>(null)
  const [digitalInventoryId, setDigitalInventoryId] = useState<string | null>(null)

  const reveal = useCallback(async () => {
    if (revealState !== 'idle') return

    setRevealState('revealing')
    setError(null)

    try {
      const res = await fetch('/api/rips/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, checkoutSessionId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Reveal failed. Please contact support.')
        setRevealState('error')
        return
      }

      setResult(data.result)
      setRevealState('revealed')
    } catch {
      setError('Network error. Please try again.')
      setRevealState('error')
    }
  }, [transactionId, checkoutSessionId, revealState])

  // Auto-reveal if returning from Stripe success
  useEffect(() => {
    if (checkoutSessionId) {
      reveal()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = useCallback(
    async (action: 'vault' | 'list' | 'ship') => {
      if (!digitalInventoryId) {
        setError('Item not found in your collection. Contact support.')
        return
      }

      setActionLoading(action)
      setError(null)

      try {
        const res = await fetch('/api/rips/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ digitalInventoryId, action }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error ?? 'Action failed.')
          return
        }

        setActionResult(data)
      } catch {
        setError('Network error.')
      } finally {
        setActionLoading(null)
      }
    },
    [digitalInventoryId],
  )

  // ─── Loading a digital inventory id after reveal ──────────────────────────
  useEffect(() => {
    if (revealState !== 'revealed' || !result) return

    // Fetch digital inventory id for the rip result
    fetch(`/api/rips/vault-item?ripResultId=${result.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.id) setDigitalInventoryId(d.id)
      })
      .catch(() => {})
  }, [revealState, result])

  // ─── Render states ────────────────────────────────────────────────────────

  if (revealState === 'idle') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#0a0a15] px-4 text-white">
        <div className="text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-yellow-400">
            Poké Rips
          </p>
          <h1 className="text-3xl font-black">Your card is waiting</h1>
          <p className="mt-2 text-sm text-gray-400">
            Tap below to reveal which card you received.
          </p>
        </div>

        <button
          onClick={reveal}
          className="rounded-2xl bg-yellow-400 px-12 py-5 text-xl font-black text-black transition hover:bg-yellow-300 active:scale-95"
        >
          RIP IT
        </button>
      </main>
    )
  }

  if (revealState === 'revealing') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0a0a15] text-white">
        <div className="relative flex items-center justify-center">
          <span className="absolute inline-flex h-32 w-32 animate-ping rounded-full bg-yellow-400 opacity-10" />
          <span className="relative text-7xl animate-pulse">◈</span>
        </div>
        <p className="text-sm text-gray-400">Allocating your card…</p>
      </main>
    )
  }

  if (revealState === 'error') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0a0a15] px-4 text-white">
        <p className="text-4xl">⚠</p>
        <p className="text-lg font-bold">Something went wrong</p>
        <p className="max-w-sm text-center text-sm text-red-400">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => setRevealState('idle')}
            className="rounded-xl border border-white/10 px-5 py-2 text-sm transition hover:bg-white/5"
          >
            Retry
          </button>
          <Link
            href="/rips"
            className="rounded-xl bg-yellow-400 px-5 py-2 text-sm font-bold text-black transition hover:bg-yellow-300"
          >
            Back to Rips
          </Link>
        </div>
      </main>
    )
  }

  // Revealed
  if (!result) return null

  const actionDone = actionResult !== null

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#0a0a15] px-4 py-12 text-white">
      {/* Card reveal */}
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
          You ripped
        </p>

        <div className="relative w-full overflow-hidden rounded-2xl border border-yellow-400/30 bg-white/5 shadow-2xl shadow-yellow-400/10">
          {result.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.image_url}
              alt={result.card_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[2.5/3.5] items-center justify-center">
              <span className="text-7xl opacity-20">◈</span>
            </div>
          )}
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-black">{result.card_name}</h2>
          {result.set_name && (
            <p className="mt-1 text-sm text-gray-400">
              {result.set_name}
              {result.card_number ? ` · #${result.card_number}` : ''}
            </p>
          )}
          {result.rarity && (
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-yellow-400">
              {result.rarity}
            </p>
          )}
          {result.grade && (
            <p className="mt-1 text-xs text-gray-500">
              {result.grade_company ?? 'Graded'} {result.grade}
            </p>
          )}
          {result.market_value_at_rip && (
            <p className="mt-2 text-sm text-gray-400">
              Market value:{' '}
              <span className="font-bold text-white">
                ${result.market_value_at_rip.toFixed(2)}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="w-full max-w-sm rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Actions */}
      {!actionDone ? (
        <div className="grid w-full max-w-sm grid-cols-3 gap-3">
          <ActionButton
            label="Vault"
            description="Store it in your collection"
            icon="◈"
            loading={actionLoading === 'vault'}
            disabled={!!actionLoading}
            onClick={() => handleAction('vault')}
          />
          <ActionButton
            label="List"
            description="Create a marketplace listing"
            icon="⊞"
            loading={actionLoading === 'list'}
            disabled={!!actionLoading}
            onClick={() => handleAction('list')}
          />
          <ActionButton
            label="Ship"
            description="Request physical delivery"
            icon="⬡"
            loading={actionLoading === 'ship'}
            disabled={!!actionLoading}
            onClick={() => handleAction('ship')}
          />
        </div>
      ) : (
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <span className="text-3xl">✓</span>
          <p className="font-bold text-white">
            {actionResult?.status === 'vaulted' && 'Card added to your vault.'}
            {actionResult?.status === 'allocated' && 'Ready to list. Go to My Listings to complete.'}
            {actionResult?.status === 'shipping' && "Shipping request submitted. We'll be in touch."}
          </p>
          <div className="flex gap-3">
            <Link
              href="/rips/vault"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5"
            >
              My Vault
            </Link>
            <Link
              href="/rips"
              className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-300"
            >
              Rip Another
            </Link>
          </div>
        </div>
      )}

      {!actionDone && (
        <Link href="/rips" className="text-xs text-gray-600 transition hover:text-gray-400">
          Decide later in your vault
        </Link>
      )}
    </main>
  )
}

function ActionButton({
  label,
  description,
  icon,
  loading,
  disabled,
  onClick,
}: {
  label: string
  description: string
  icon: string
  loading: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-center transition hover:border-yellow-400/40 hover:bg-yellow-400/10 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="text-2xl">{loading ? '…' : icon}</span>
      <span className="text-xs font-bold text-white">{label}</span>
      <span className="text-[10px] leading-tight text-gray-500">{description}</span>
    </button>
  )
}
