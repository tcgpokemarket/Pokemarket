import Link from 'next/link'
import { getActivePacks } from '@/lib/rips'
import type { RipPack } from '@/lib/rips'

export const metadata = {
  title: 'Poké Rips',
  description: 'Open digital packs and win real Pokémon cards.',
}

export const revalidate = 60

const TIER_BALLS = [
  { maxPrice: 1, name: 'Poké Ball', slug: 'poke-ball' },
  { maxPrice: 5, name: 'Great Ball', slug: 'great-ball' },
  { maxPrice: 10, name: 'Ultra Ball', slug: 'ultra-ball' },
  { maxPrice: 25, name: 'Premier Ball', slug: 'premier-ball' },
  { maxPrice: 50, name: 'Luxury Ball', slug: 'luxury-ball' },
  { maxPrice: 250, name: 'Beast Ball', slug: 'beast-ball' },
  { maxPrice: Number.POSITIVE_INFINITY, name: 'Master Ball', slug: 'master-ball' },
] as const

const POKEBALL_IMAGE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items'

function getTierBall(pack: RipPack) {
  const byName = TIER_BALLS.find((ball) => `${ball.name.replace(' Ball', '')} Pack` === pack.name.replace(/\$\d+ /, ''))
  if (byName) return byName
  return TIER_BALLS.find((ball) => pack.price <= ball.maxPrice) ?? TIER_BALLS[TIER_BALLS.length - 1]
}

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
            Each pack contains a real physical card that ships to you — or you can vault it or sell it back at the fixed Rips price.
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
  const tierBall = getTierBall(pack)
  const tierImage = `${POKEBALL_IMAGE_BASE}/${tierBall.slug}.png`

  return (
    <Link
      href={soldOut ? '#' : `/rips/${pack.id}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border transition
        ${soldOut
          ? 'cursor-not-allowed border-white/5 opacity-50'
          : 'border-white/10 hover:border-yellow-400/40 hover:shadow-lg hover:shadow-yellow-400/5'
        }`}
    >
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(255,196,0,0.12),transparent_65%)]">
        {/* Each standard Rips price tier has its own progressively higher Poké Ball. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tierImage}
          alt={`${tierBall.name} — ${pack.name} tier`}
          className="h-36 w-36 object-contain drop-shadow-2xl transition-transform duration-300 group-hover:scale-110 sm:h-44 sm:w-44"
        />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 backdrop-blur">
          {tierBall.name} Tier
        </div>
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
              Sold Out
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400/70">{tierBall.name} Tier</p>
            <h2 className="mt-1 font-bold text-white">{pack.name}</h2>
          </div>
          <span className="text-lg font-black text-yellow-400">${pack.price.toFixed(2)}</span>
        </div>

        {pack.description && (
          <p className="line-clamp-2 text-xs text-gray-400">{pack.description}</p>
        )}

        <div className="mt-auto flex items-center justify-end pt-3">
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
      body: 'Browse available tiers. Each tier uses a different Poké Ball, from Poké Ball at the lowest price to Master Ball at the highest.',
    },
    {
      num: '02',
      title: 'Pay and rip',
      body: 'Checkout securely via Stripe. Your card is allocated server-side the moment payment clears.',
    },
    {
      num: '03',
      title: 'Vault or ship',
      body: 'Keep the card in your vault or pay the shipping charge to have it physically shipped. Rips cards are not normal marketplace listings.',
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
