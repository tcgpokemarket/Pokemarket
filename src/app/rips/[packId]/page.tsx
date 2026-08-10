import { notFound } from 'next/navigation'
import { getPackById, getActivePackVersion } from '@/lib/rips'
import PackDetailClient from './PackDetailClient'

export const revalidate = 30

export async function generateStaticParams() {
  return [{ packId: 'preview' }]
}

interface Props {
  params: Promise<{ packId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { packId } = await params
  if (packId === 'preview') return { title: 'Pack Preview' }

  const pack = await getPackById(packId)
  if (!pack) return { title: 'Pack Not Found' }

  return {
    title: `${pack.name} — Poké Rips`,
    description: pack.description ?? `Open a ${pack.name} pack and win a real card.`,
  }
}

export default async function PackDetailPage({ params }: Props) {
  const { packId } = await params

  // Static preview placeholder rendered at build time
  if (packId === 'preview') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a15] text-white">
        <p className="text-gray-500">Loading pack…</p>
      </main>
    )
  }

  const [pack, version] = await Promise.all([
    getPackById(packId),
    getActivePackVersion(packId),
  ])

  if (!pack || pack.status !== 'active') notFound()

  return <PackDetailClient pack={pack} version={version} />
}
