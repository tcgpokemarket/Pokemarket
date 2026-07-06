'use client'
import { createClient } from '@/lib/supabase/client'

export default function SellForm() {
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('listings').insert({
      seller_id: user.id,
      title: form.get('title'),
      price: Number(form.get('price')),
      description: form.get('description'),
    } as any)
  }
  return (
    <form onSubmit={submit}>
      <input name="title" placeholder="Card name" />
      <input name="price" placeholder="Price" />
      <textarea name="description" placeholder="Condition/details" />
      <button>Create Listing</button>
    </form>
  )
}
