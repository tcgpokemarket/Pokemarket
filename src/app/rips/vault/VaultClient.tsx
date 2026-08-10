'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { DigitalInventoryItem } from '@/lib/rips'

interface Props {
  items: DigitalInventoryItem[]
}

export default function VaultClient({ items: initialItems }: Props) {
  const [items, setItems] = useState<DigitalInventoryItem[]>(initialItems)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAction = useCallback(
    async (digitalInventoryId: string, action: 'vault' | 'unvault' | 'list' | 'ship') => {
      setActionLoading(digitalInventoryId + action)
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

        setItems((prev) =>
          prev.map((item) =>
            item.id === digitalInventoryId
              ? { ...item, status: data.status }
              : item,
          ),
        )
      } catch {
        setError('Network error.')
      } finally {
        setActionLoading(null)
      }
    },
    [],
  )

  return (
    <main className="min-h-screen bg-[#0a0a15] text-white">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-yellow-400">
              Poké Rips
            </p>
            <h1 className="text-3xl font-black">My Vault</h1>
          </div>
          <Link
            href="/rips"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5"
          >
            Browse Packs
          </Link>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 py-20 text-center">
            <span className="text-5xl opacity-30">◈</span>
            <p className="text-sm text-gray-400">Your vault is empty.</p>
            <Link
              href="/rips"
              className="rounded-xl bg-yellow-400 px-5 py-2 text-sm font-bold text-black transition hover:bg-yellow-300"
            >
              Rip a Pack
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <VaultCard
                key={item.id}
                item={item}
                onAction={handleAction}
                loading={
                  actionLoading?.startsWith(item.id) ? actionLoading : null
                }
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function VaultCard({
  item,
  onAction,
  loading,
}: {
  item: DigitalInventoryItem
  onAction: (id: string, action: 'vault' | 'unvault' | 'list' | 'ship') => void
  loading: string | null
}) {
  const card = item.physical
  const isLoading = !!loading

  const statusLabel: Record<string, string> = {
    available: 'Available',
    vaulted: 'Vaulted',
    listed: 'Listed',
    allocated: 'Pending listing',
    shipping: 'Shipping requested',
    shipped: 'Shipped',
    completed: 'Completed',
    sold: 'Sold',
    disputed: 'Disputed',
    locked: 'Locked',
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="relative aspect-[2.5/3.5] w-full overflow-hidden bg-white/5">
        {card?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image_url}
            alt={card.card_name ?? 'Card'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-5xl opacity-20">◈</span>
          </div>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white">
          {statusLabel[item.status] ?? item.status}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="font-bold text-white">{card?.card_name ?? '—'}</p>
          {card?.set_name && (
            <p className="text-xs text-gray-500">
              {card.set_name}
              {card.card_number ? ` · #${card.card_number}` : ''}
            </p>
          )}
          {card?.rarity && (
            <p className="text-xs text-yellow-400">{card.rarity}</p>
          )}
        </div>

        {item.market_value_at_acquisition && (
          <p className="text-xs text-gray-500">
            Value at rip:{' '}
            <span className="text-white">${item.market_value_at_acquisition.toFixed(2)}</span>
          </p>
        )}

        {/* Actions — only for available/vaulted items */}
        {(item.status === 'available' || item.status === 'vaulted') && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {item.status === 'available' && (
              <button
                onClick={() => onAction(item.id, 'vault')}
                disabled={isLoading}
                className="rounded-lg border border-white/10 px-2 py-1.5 text-xs font-semibold transition hover:bg-white/5 disabled:opacity-40"
              >
                {loading === item.id + 'vault' ? '…' : 'Vault'}
              </button>
            )}
            {item.status === 'vaulted' && (
              <button
                onClick={() => onAction(item.id, 'unvault')}
                disabled={isLoading}
                className="rounded-lg border border-white/10 px-2 py-1.5 text-xs font-semibold transition hover:bg-white/5 disabled:opacity-40"
              >
                {loading === item.id + 'unvault' ? '…' : 'Unvault'}
              </button>
            )}
            <button
              onClick={() => onAction(item.id, 'list')}
              disabled={isLoading}
              className="rounded-lg border border-white/10 px-2 py-1.5 text-xs font-semibold transition hover:bg-white/5 disabled:opacity-40"
            >
              {loading === item.id + 'list' ? '…' : 'List'}
            </button>
            <button
              onClick={() => onAction(item.id, 'ship')}
              disabled={isLoading}
              className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-2 py-1.5 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-400/20 disabled:opacity-40"
            >
              {loading === item.id + 'ship' ? '…' : 'Ship'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
