export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth-api'

const TEMPLATE_HEADERS = [
  'pokemon_name',
  'card_id',
  'set_id',
  'set_name',
  'card_number',
  'language',
  'condition',
  'grade',
  'grading_company',
  'certification_number',
  'market_value',
  'acquisition_cost',
  'image_url',
  'pack_id',
  'pack_version_id',
  'warehouse_location',
  'notes',
]

const EXAMPLE_ROW = [
  'Charizard ex',           // pokemon_name
  'sv3pt5-54',              // card_id
  'sv3pt5',                 // set_id
  '151',                    // set_name
  '54',                     // card_number
  'en',                     // language
  'NM',                     // condition
  '9.5',                    // grade (leave blank if ungraded)
  'PSA',                    // grading_company
  '12345678',               // certification_number
  '89.99',                  // market_value
  '55.00',                  // acquisition_cost
  '',                       // image_url (leave blank to use official card art)
  '',                       // pack_id (leave blank to assign later)
  '',                       // pack_version_id
  'BIN-A4',                 // warehouse_location
  '',                       // notes
]

export async function GET() {
  const auth = await requireAdminUser()
  if (auth.error) return auth.error

  const csv = [
    TEMPLATE_HEADERS.join(','),
    EXAMPLE_ROW.map((v) => `"${v}"`).join(','),
  ].join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="rip-inventory-template.csv"',
    },
  })
}
