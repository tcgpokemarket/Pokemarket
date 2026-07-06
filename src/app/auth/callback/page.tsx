import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Callback(){
 const supabase=await createClient()
 await supabase.auth.getSession()
 redirect('/')
}
