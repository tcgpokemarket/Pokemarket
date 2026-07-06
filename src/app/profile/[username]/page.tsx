import {createClient} from '@/lib/supabase/server'

interface Profile {
  id: string
  username: string | null
  email: string
  bio: string | null
  avatar_url: string | null
}

export default async function Page({params}:{params:{username:string}}){
  const supabase=await createClient()
  const {data}=await supabase.from('profiles').select('*').eq('username',params.username).single<Profile>()
  return <main><h1>{data?.username||params.username}</h1><p>TCG Poke Market Seller</p></main>
}
