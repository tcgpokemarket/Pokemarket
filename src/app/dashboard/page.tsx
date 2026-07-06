import {createClient} from '@/lib/supabase/server'
export default async function Dashboard(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();return <main><h1>Seller Dashboard</h1><p>{user?.email||'Please login'}</p></main>}
