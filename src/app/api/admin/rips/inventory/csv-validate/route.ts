export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth-api'
import { parseCSV, validateCSV } from '@/lib/admin-rips'

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser(req)
  if (auth.error) return auth.error

  let csvText: string
  try {
    const body = await req.json()
    csvText = String(body.csv ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: 'CSV content is empty.' }, { status: 400 })
  }

  const rows = parseCSV(csvText)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No data rows found in CSV.' }, { status: 400 })
  }

  if (rows.length > 1000) {
    return NextResponse.json({ error: 'Maximum 1000 rows per import.' }, { status: 400 })
  }

  const summary = await validateCSV(rows)

  return NextResponse.json(summary)
}
