import { generateStaticParams as _gsp } from './generateStaticParams'
import RipRevealClient from './RipRevealClient'

export { _gsp as generateStaticParams }

export const metadata = {
  title: 'Your Rip — Poké Rips',
}

interface Props {
  params: Promise<{ transactionId: string }>
  searchParams: Promise<{ session_id?: string }>
}

export default async function RipRevealPage({ params, searchParams }: Props) {
  const { transactionId } = await params
  const { session_id } = await searchParams

  if (transactionId === 'preview') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a15] text-white">
        <p className="text-gray-500">Loading…</p>
      </main>
    )
  }

  return (
    <RipRevealClient
      transactionId={transactionId}
      checkoutSessionId={session_id ?? null}
    />
  )
}
