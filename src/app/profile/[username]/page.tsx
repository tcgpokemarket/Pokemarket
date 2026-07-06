import { createClient } from '@/lib/supabase/server'

interface Profile {
  username: string
  display_name?: string
}

export default async function Page({
  params,
}: {
  params: { username: string }
}) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', params.username)
    .single<Profile>()

  return (
    <main>
      <h1>{data?.display_name || params.username}</h1>
      <p>TCG Poke Market Seller</p>
    </main>
  )
}
