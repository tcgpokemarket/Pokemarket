import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const folder = process.env.CLOUDINARY_UPLOAD_FOLDER ?? ''
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? ''
    const apiKey = process.env.CLOUDINARY_API_KEY ?? ''

    if (!process.env.CLOUDINARY_API_SECRET || !cloudName || !apiKey) {
      return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 })
    }

    let paramsToSign = `timestamp=${timestamp}`
    if (folder) paramsToSign += `&folder=${folder}`

    const signature = crypto.createHash('sha1').update(paramsToSign + process.env.CLOUDINARY_API_SECRET).digest('hex')

    return NextResponse.json({ timestamp, signature, apiKey, cloudName, uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET ?? null, folder })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
