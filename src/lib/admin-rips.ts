/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'
import { fetchCardPrice } from '@/lib/prices'
import { writeAuditLog } from '@/lib/rips'

function adminDb() { return _createAdminClient() as any }

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InventoryRow {
  id: string
  pack_id: string | null
  pack_version_id: string | null
  card_id: string | null
  card_name: string
  set_name: string | null
  set_id: string | null
  card_number: string | null
  rarity: string | null
  language: string
  condition: string
  grade: string | null
  grade_company: string | null
  certification_number: string | null
  image_url: string | null
  market_value: number | null
  acquisition_cost: number | null
  warehouse_location: string | null
  inventory_status: string
  ownership_status: string
  notes: string | null
  created_at: string
  updated_at: string
  pack?: { name: string; status: string } | null
  version?: { version_number: number } | null
}

export interface InventoryStats {
  total: number
  available: number
  allocated: number
  sold: number
  shipped: number
  locked: number
  unassigned: number
  vaulted: number
  returned: number
}

export interface CSVRow {
  pokemon_name?: string
  card_id?: string
  set_id?: string
  set_name?: string
  card_number?: string
  language?: string
  condition?: string
  grade?: string
  grading_company?: string
  certification_number?: string
  market_value?: string
  acquisition_cost?: string
  image_url?: string
  pack_id?: string
  pack_version_id?: string
  warehouse_location?: string
  notes?: string
}

export interface ValidationResult {
  index: number
  row: CSVRow
  errors: string[]
}

export interface CSVValidationSummary {
  total: number
  valid: ValidationResult[]
  invalid: ValidationResult[]
  duplicates: ValidationResult[]
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getInventoryStats(): Promise<InventoryStats> {
  const db = adminDb()
  const { data } = await db
    .from('rip_physical_inventory')
    .select('inventory_status, pack_id')

  const rows: { inventory_status: string; pack_id: string | null }[] = data ?? []

  const stats: InventoryStats = {
    total: rows.length,
    available: 0,
    allocated: 0,
    sold: 0,
    shipped: 0,
    locked: 0,
    unassigned: 0,
    vaulted: 0,
    returned: 0,
  }

  for (const r of rows) {
    if (r.inventory_status === 'available') stats.available++
    if (r.inventory_status === 'allocated') stats.allocated++
    if (r.inventory_status === 'shipped') stats.shipped++
    if (r.inventory_status === 'destroyed') stats.locked++ // map destroyed → locked for display
    if (r.inventory_status === 'returned') stats.returned++
    if (!r.pack_id) stats.unassigned++
  }

  return stats
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

export function parseCSV(text: string): CSVRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase())

  return lines
    .slice(1)
    .map((line) => {
      const values = splitCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        row[h] = (values[i] ?? '').trim()
      })
      return row as CSVRow
    })
    .filter((row) => Object.values(row).some((v) => v !== ''))
}

function splitCSVLine(line: string): string[] {
  const values: string[] = []
  let cur = ''
  let inQ = false

  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (c === ',' && !inQ) {
      values.push(cur); cur = ''
    } else {
      cur += c
    }
  }
  values.push(cur)
  return values.map((v) => v.replace(/^"|"$/g, ''))
}

export async function validateCSV(rows: CSVRow[]): Promise<CSVValidationSummary> {
  const db = adminDb()

  // Pre-fetch existing certification numbers for duplicate detection
  const certNums = rows
    .map((r) => r.certification_number?.trim())
    .filter(Boolean) as string[]

  let existingCerts = new Set<string>()
  if (certNums.length > 0) {
    const { data } = await db
      .from('rip_physical_inventory')
      .select('certification_number')
      .in('certification_number', certNums)
    existingCerts = new Set((data ?? []).map((r: any) => r.certification_number))
  }

  const valid: ValidationResult[] = []
  const invalid: ValidationResult[] = []
  const duplicates: ValidationResult[] = []
  const seenCerts = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const errors: string[] = []

    const name = row.pokemon_name?.trim()
    if (!name) errors.push('pokemon_name is required')
    if (!row.condition?.trim()) errors.push('condition is required')

    const certNum = row.certification_number?.trim()
    if (certNum) {
      if (existingCerts.has(certNum)) {
        duplicates.push({ index: i + 2, row, errors: [`Certification number "${certNum}" already exists in database`] })
        continue
      }
      if (seenCerts.has(certNum)) {
        duplicates.push({ index: i + 2, row, errors: [`Certification number "${certNum}" appears multiple times in this CSV`] })
        continue
      }
      seenCerts.add(certNum)
    }

    if (row.market_value && isNaN(parseFloat(row.market_value))) {
      errors.push('market_value must be a number')
    }
    if (row.acquisition_cost && isNaN(parseFloat(row.acquisition_cost))) {
      errors.push('acquisition_cost must be a number')
    }

    const result: ValidationResult = { index: i + 2, row, errors }
    if (errors.length > 0) invalid.push(result)
    else valid.push(result)
  }

  return {
    total: rows.length,
    valid,
    invalid,
    duplicates,
  }
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importValidatedRows(
  rows: CSVRow[],
  adminId: string,
  ipAddress?: string,
): Promise<{ imported: number; errors: string[] }> {
  const db = adminDb()
  const errors: string[] = []
  let imported = 0

  for (const row of rows) {
    try {
      const payload = {
        card_id: row.card_id?.trim() || null,
        card_name: (row.pokemon_name ?? '').trim(),
        set_name: row.set_name?.trim() || null,
        set_id: row.set_id?.trim() || null,
        card_number: row.card_number?.trim() || null,
        language: row.language?.trim() || 'en',
        condition: row.condition?.trim() || 'NM',
        grade: row.grade?.trim() || null,
        grade_company: row.grading_company?.trim() || null,
        certification_number: row.certification_number?.trim() || null,
        image_url: row.image_url?.trim() || null,
        market_value: row.market_value ? parseFloat(row.market_value) : null,
        acquisition_cost: row.acquisition_cost ? parseFloat(row.acquisition_cost) : null,
        pack_id: row.pack_id?.trim() || null,
        pack_version_id: row.pack_version_id?.trim() || null,
        warehouse_location: row.warehouse_location?.trim() || null,
        notes: row.notes?.trim() || null,
        inventory_status: row.pack_id?.trim() ? 'available' : 'available',
        ownership_status: 'platform',
      }

      const { data: inserted, error: insertErr } = await db
        .from('rip_physical_inventory')
        .insert(payload)
        .select('id')
        .single()

      if (insertErr) {
        errors.push(`Row "${payload.card_name}": ${insertErr.message}`)
        continue
      }

      // Capture pricing snapshot
      if (payload.card_name) {
        fetchCardPrice(payload.card_name, payload.set_name ?? '')
          .then(async (price) => {
            if (price.marketPrice !== null) {
              await db.from('rip_pricing_snapshots').insert({
                rip_result_id: null,
                card_name: payload.card_name,
                set_name: payload.set_name,
                market_price: price.marketPrice,
                low_price: price.lowPrice,
                high_price: price.highPrice,
                source: price.source,
              }).catch(() => {})
            }
          })
          .catch(() => {})
      }

      await writeAuditLog({
        event_type: 'CARD_IMPORTED',
        admin_id: adminId,
        physical_inventory_id: inserted.id,
        pack_id: payload.pack_id ?? undefined,
        payload: { card_name: payload.card_name, method: 'csv', ip: ipAddress },
        ip_address: ipAddress,
      })

      imported++
    } catch (err: any) {
      errors.push(`Row "${row.pokemon_name}": ${err?.message ?? 'Unknown error'}`)
    }
  }

  return { imported, errors }
}

// ─── Pack inventory summary ───────────────────────────────────────────────────

export async function getPackInventorySummary(packId: string) {
  const db = adminDb()

  const { data: cards } = await db
    .from('rip_physical_inventory')
    .select('*')
    .eq('pack_id', packId)

  const rows: InventoryRow[] = cards ?? []

  const values = rows.map((r) => r.market_value ?? 0).filter((v) => v > 0)

  return {
    total: rows.length,
    available: rows.filter((r) => r.inventory_status === 'available').length,
    allocated: rows.filter((r) => r.inventory_status === 'allocated').length,
    remaining: rows.filter((r) => r.inventory_status === 'available').length,
    totalValue: values.reduce((a, b) => a + b, 0),
    averageValue: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    highestValue: values.length ? Math.max(...values) : 0,
    lowestValue: values.length ? Math.min(...values) : 0,
    cards: rows,
  }
}
