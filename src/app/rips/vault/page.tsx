import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getUserVaultItems } from '@/lib/rips'
import VaultClient from './VaultClient'
import type { DigitalInventoryItem } from '@/lib/rips'

export const metadata = {
  title: 'My Rips Vault',
}

export default async function RipsVaultPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  let items: DigitalInventoryItem[] = []
  try {
    items = await getUserVaultItems(user.id)
  } catch {
    // Render empty
  }

  return <VaultClient items={items} />
}
