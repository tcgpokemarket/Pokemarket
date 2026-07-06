import { createClient } from '@/lib/supabase/server'

export default async function Listings(){
 const supabase=await createClient()
 const {data}=await supabase.from('listings').select('*')
 return <main><h1>TCG Poke Market</h1>{(data||[]).map((item:any)=><p key={item.id}>{item.title} ${item.price}</p>)}</main>
}
