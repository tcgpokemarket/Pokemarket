'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { RipPack, RipPackVersion } from '@/lib/rips'

interface Props {
  pack: RipPack
  version: RipPackVersion | null
}

function randomIdempotencyKey(packId: string): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  const hex = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${packId}:${hex}`
}

export default function PackDetailClient({ pack, version }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePurchase = useCallback(async () => {
    if (!version) {
      setError('Pack configuration unavailable. Try again shortly.')
      return
    }

    setLoading(true)
    setError(null)

    const idempotencyKey = randomIdempotencyKey(pack.id)

    try {
      const res = await fetch('/api/rips/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packId: pack.id,
          idempotencyKey,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Purchase failed. Please try again.')
        return
      }

      if (data.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkoutUrl
      } else if (data.transactionId) {
        // Already paid — go straight to reveal
        router.push(`/rips/rip/${data.transactionId}`)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [pack.id, version, router])

  const soldOut = pack.available_quantity <= 0

  return (
    <main className="min-h-screen bg-[#0a0a15] text-white">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <a href="/rips" className="mb-8 inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-300">
          ← Back to Rips
        </a>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Pack image */}
          <div className="aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {pack.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pack.cover_image_url}
                alt={pack.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="text-7xl opacity-20">◈</span>
              </div>
            )}
          </div>

          {/* Pack details */}
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-yellow-400">
                Poké Rips
              </p>
              <h1 className="text-3xl font-black tracking-tight">{pack.name}</h1>
              {pack.description && (
                <p className="mt-2 text-sm text-gray-400">{pack.description}</p>
              )}
            </div>

            {/* Value range */}
            {(pack.min_value || pack.max_advertised_value) && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="mb-1 text-xs text-gray-500">Card value range</p>
                <p className="font-bold text-white">
                  ${(pack.min_value ?? 0).toFixed(2)}
                  {pack.max_advertised_value
                    ? ` — $${pack.max_advertised_value.toFixed(2)}`
                    : '+'}
                </p>
              </div>
            )}

            {/* Chase cards */}
            {pack.chase_cards.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                  Possible chase cards
                </p>
                <div className="flex flex-wrap gap-2">
                  {pack.chase_cards.map((c, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs text-yellow-300"
                    >
                      {c.card_name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Inventory status */}
            <p className="text-xs text-gray-600">
              {soldOut ? 'Sold out' : `${pack.available_quantity} pack${pack.available_quantity === 1 ? '' : 's'} remaining`}
            </p>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handlePurchase}
              disabled={soldOut || loading || !version}
              className="w-full rounded-2xl bg-yellow-400 py-4 text-base font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading
                ? 'Redirecting to checkout…'
                : soldOut
                  ? 'Sold Out'
                  : `Rip for $${pack.price.toFixed(2)}`}
            </button>

            <p className="text-center text-xs text-gray-600">
              Secure checkout via Stripe. Each pack contains one physical card shipped to you.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
