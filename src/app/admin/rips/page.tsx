import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminRipsClient from './AdminRipsClient'

export const metadata = {
  title: 'Admin — Rips',
}

export default async function AdminRipsPage() {
  // Server Components can read request cookies, but Next.js does not allow
  // them to mutate cookies. The shared Supabase server client safely ignores
  // refresh-cookie writes here; auth/session mutation belongs in a Route
  // Handler or middleware.
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'super_admin'].includes(profile.role ?? '')) {
    redirect('/')
  }

  const admin = createAdminClient()

  const [
    { data: packs },
    { data: recentTx },
    { count: totalTx },
    { count: revealedTx },
  ] = await Promise.all([
    admin.from('rip_packs').select('*').order('sort_order'),
    admin
      .from('rip_transactions')
      .select('*, profiles(email)')
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('rip_transactions')
      .select('id', { count: 'exact', head: true }),
    admin
      .from('rip_transactions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['revealed', 'completed']),
  ])

  return (
    <AdminRipsClient
      packs={packs ?? []}
      recentTransactions={recentTx ?? []}
      stats={{ total: totalTx ?? 0, revealed: revealedTx ?? 0 }}
    />
  )
}
