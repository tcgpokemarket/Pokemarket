import Link from 'next/link'
import { getActivePacks } from '@/lib/rips'
import type { RipPack } from '@/lib/rips'

export const metadata = {
  title: 'Poké Rips',
  description: 'Open digital packs and win real Pokémon cards.',
}

export const revalidate = 60

export default async function RipsPage() {
  let packs: RipPack[] = []
  try {
    packs = await getActivePacks()
  } catch {
    // Render empty state — don't crash
  }

  return (
    <main className="min-h-screen bg-[#0a0a15] text-white">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <header className="mb-10">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-yellow-400">
            Poké Rips
          </p>
          <h1 className="text-3xl font-black tracking-tight">Digital Pack Opening</h1>
          <p className="mt-2 max-w-xl text-sm text-gray-400">
            Each pack contains a real physical card that ships to you — or you can sell, list,
            or vault it from your collection.
          </p>
        </header>

        {packs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((pack) => (
              <PackCard key={pack.id} pack={pack} />
            ))}
          </div>
        )}

        <HowItWorks />
      </div>
    </main>
  )
}

function PackCard({ pack }: { pack: RipPack }) {
  const soldOut = pack.available_quantity <= 0

  return (
    <Link
      href={soldOut ? '#' : `/rips/${pack.id}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border transition
        ${soldOut
          ? 'cursor-not-allowed border-white/5 opacity-50'
          : 'border-white/10 hover:border-yellow-400/40 hover:shadow-lg hover:shadow-yellow-400/5'
        }`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/5">
        {pack.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pack.cover_image_url}
            alt={pack.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-5xl opacity-30">◈</span>
          </div>
        )}
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
              Sold Out
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="font-bold text-white">{pack.name}</h2>
        {pack.description && (
          <p className="line-clamp-2 text-xs text-gray-400">{pack.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-lg font-black text-yellow-400">
            ${pack.price.toFixed(2)}
          </span>
          {!soldOut && (
            <span className="text-xs text-gray-500">
              {pack.available_quantity} left
            </span>
          )}
        </div>

        {pack.min_value && pack.max_advertised_value && (
          <p className="text-xs text-gray-500">
            Card value: ${pack.min_value.toFixed(0)}–${pack.max_advertised_value.toFixed(0)}
          </p>
        )}
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 py-20 text-center">
      <span className="text-5xl opacity-30">◈</span>
      <p className="text-sm text-gray-400">No packs available right now.</p>
      <p className="text-xs text-gray-600">Check back soon.</p>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Choose a pack',
      body: 'Browse available packs. Each one contains a specific card or set of cards.',
    },
    {
      num: '02',
      title: 'Pay and rip',
      body: 'Checkout securely via Stripe. Your card is allocated server-side the moment payment clears.',
    },
    {
      num: '03',
      title: 'Keep, sell, or ship',
      body: 'Vault the card in your collection, list it for sale, request a physical shipment, or go to auction.',
    },
  ]

  return (
    <section className="mt-16">
      <h2 className="mb-6 text-sm font-bold uppercase tracking-widest text-gray-500">
        How it works
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.num} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <span className="text-2xl font-black text-yellow-400/40">{s.num}</span>
            <h3 className="mt-2 font-bold text-white">{s.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
