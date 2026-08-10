export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth-api'
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/rips'

function adminDb() { return _createAdminClient() as any }

const BUCKET = 'rip-cards'
const MAX_SIZE = 8 * 1024 * 1024 // 8 MB

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser(req)
  if (auth.error) return auth.error

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const inventoryId = formData.get('inventory_id') as string | null

  if (!file) {
    return NextResponse.json({ error: 'file is required.' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Image must be 8 MB or smaller.' }, { status: 413 })
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are accepted.' }, { status: 415 })
  }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const path = `inventory/${auth.user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const db = adminDb()

  const { error: uploadErr } = await db.storage
    .from(BUCKET)
    .upload(path, new Uint8Array(arrayBuffer), {
      contentType: file.type,
      upsert: false,
    })

  if (uploadErr) {
    // Bucket may not exist yet — surface a clear error
    if (uploadErr.message?.includes('Bucket not found')) {
      return NextResponse.json(
        { error: 'Storage bucket "rip-cards" does not exist. Create it in your Supabase dashboard.' },
        { status: 503 },
      )
    }
    console.error('[upload-image] upload error:', uploadErr)
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  // If inventory_id provided, update the card record immediately
  if (inventoryId) {
    await db
      .from('rip_physical_inventory')
      .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', inventoryId)

    await writeAuditLog({
      event_type: 'CARD_IMAGE_UPDATED',
      admin_id: auth.user.id,
      physical_inventory_id: inventoryId,
      payload: { path, publicUrl },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
    })
  }

  return NextResponse.json({ url: publicUrl, path })
}
