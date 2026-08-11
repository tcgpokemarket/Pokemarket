import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/security'
import AdminRipsClient from './AdminRipsClient'

export const metadata = {
  title: 'Admin — Rips',
}

export default async function AdminRipsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // Rips admin access is restricted to the single owner login.
  if (!isAdmin(user)) redirect('/')

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
