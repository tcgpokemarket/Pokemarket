import { createClient } from '@/lib/supabase/server'

interface Listing {
  id: string
  title: string
  description: string
  price: number
}

export default async function Page({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('listings')
    .select('*')
    .eq('id', params.id)
    .single<Listing>()

  return (
    <main>
      <h1>{data?.title}</h1>
      <p>{data?.description}</p>
      <h2>${data?.price}</h2>
    </main>
  )
}
