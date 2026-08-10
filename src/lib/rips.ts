/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient as _createAdminClient } from '@/lib/supabase/admin'
import { fetchCardPrice } from '@/lib/prices'

function createAdminClient() { return _createAdminClient() as any }

// ─── Public types ────────────────────────────────────────────────────────────

export interface RipPack {
  id: string
  name: string
  description: string | null
  cover_image_url: string | null
  category: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  price: number
  inventory_count: number
  available_quantity: number
  min_value: number | null
  max_advertised_value: number | null
  expected_value: number | null
  chase_cards: ChaseCard[]
  rarity_distribution: Record<string, number>
  starts_at: string | null
  ends_at: string | null
  max_per_user: number | null
  active_version_id: string | null
  sort_order: number
  jurisdiction_availability: Record<string, boolean>
}

export interface ChaseCard {
  card_name: string
  set_name?: string
  image_url?: string
  market_value?: number
}

export interface RipPackVersion {
  id: string
  pack_id: string
  version_number: number
  configuration_hash: string
  rarity_distribution: Record<string, number>
  price: number
  eligibility_rules: Record<string, unknown>
  jurisdiction_availability: Record<string, boolean>
  notes: string | null
  activated_at: string | null
}

export interface RipTransaction {
  id: string
  idempotency_key: string
  user_id: string
  pack_id: string
  pack_version_id: string | null
  status: RipTransactionStatus
  amount: number
  currency: string
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  payment_confirmed_at: string | null
  allocated_at: string | null
  revealed_at: string | null
  completed_at: string | null
  jurisdiction: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export type RipTransactionStatus =
  | 'pending'
  | 'payment_processing'
  | 'paid'
  | 'allocating'
  | 'allocated'
  | 'revealed'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'disputed'

export interface RipResult {
  id: string
  transaction_id: string
  user_id: string
  pack_id: string
  physical_inventory_id: string
  card_id: string | null
  card_name: string
  set_name: string | null
  card_number: string | null
  rarity: string | null
  condition: string | null
  grade: string | null
  grade_company: string | null
  image_url: string | null
  market_value_at_rip: number | null
  pack_price_at_rip: number | null
  randomization_ref: string | null
  created_at: string
}

export interface DigitalInventoryItem {
  id: string
  user_id: string
  physical_inventory_id: string
  rip_result_id: string | null
  source_type: 'rip' | 'trade' | 'purchase' | 'reward' | 'manual'
  status: DigitalInventoryStatus
  market_value_at_acquisition: number | null
  acquired_at: string
  listing_id: string | null
  shipment_group_id: string | null
  physical?: PhysicalInventoryCard
}

export type DigitalInventoryStatus =
  | 'available'
  | 'allocated'
  | 'vaulted'
  | 'listed'
  | 'sold'
  | 'shipping'
  | 'shipped'
  | 'completed'
  | 'disputed'
  | 'locked'

export interface PhysicalInventoryCard {
  id: string
  pack_id: string
  card_id: string | null
  card_name: string
  set_name: string | null
  card_number: string | null
  rarity: string | null
  condition: string
  grade: string | null
  grade_company: string | null
  certification_number: string | null
  image_url: string | null
  market_value: number | null
  inventory_status: 'available' | 'allocated' | 'shipped' | 'returned' | 'destroyed'
  ownership_status: 'platform' | 'user_vault' | 'user_shipping' | 'sold' | 'returned'
  warehouse_location: string | null
}

export interface JurisdictionRule {
  jurisdiction_code: string
  pack_id: string | null
  is_allowed: boolean
  min_age: number
  requires_kyc: boolean
  requires_aml: boolean
  max_spend_per_day: number | null
  max_spend_per_month: number | null
}

// ─── Jurisdiction helpers ─────────────────────────────────────────────────────

/**
 * Returns the best-matching jurisdiction rule for (code, pack), preferring
 * the pack-specific rule over the global default.
 * Never exposes the full rules list to the caller.
 */
export async function getJurisdictionRule(
  jurisdictionCode: string,
  packId?: string,
): Promise<JurisdictionRule | null> {
  const supabase = createAdminClient()

  // Check pack-specific rule first, then country-level, then broad default
  const codesToTry = [
    packId ? `${jurisdictionCode}|${packId}` : null,
    jurisdictionCode,
    jurisdictionCode.split('-')[0], // e.g. 'US' from 'US-CA'
  ].filter(Boolean) as string[]

  for (const code of codesToTry) {
    const isPack = code.includes('|')
    const [jCode, pId] = isPack ? code.split('|') : [code, null]

    const query = supabase
      .from('rip_jurisdiction_rules')
      .select('*')
      .eq('jurisdiction_code', jCode)

    const { data } = pId
      ? await query.eq('pack_id', pId).maybeSingle()
      : await query.is('pack_id', null).maybeSingle()

    if (data) return data as JurisdictionRule
  }

  return null
}

export async function isJurisdictionAllowed(
  jurisdictionCode: string,
  packId?: string,
): Promise<boolean> {
  const rule = await getJurisdictionRule(jurisdictionCode, packId)
  if (!rule) return false // deny by default if no rule found
  return rule.is_allowed
}

// ─── Pack helpers ─────────────────────────────────────────────────────────────

export async function getActivePacks(): Promise<RipPack[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('rip_packs')
    .select('*')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as RipPack[]
}

export async function getPackById(packId: string): Promise<RipPack | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('rip_packs')
    .select('*')
    .eq('id', packId)
    .maybeSingle()

  if (error) throw error
  return data as RipPack | null
}

export async function getActivePackVersion(
  packId: string,
): Promise<RipPackVersion | null> {
  const supabase = createAdminClient()
  const { data: pack } = await supabase
    .from('rip_packs')
    .select('active_version_id')
    .eq('id', packId)
    .maybeSingle()

  if (!pack?.active_version_id) return null

  const { data, error } = await supabase
    .from('rip_pack_versions')
    .select('*')
    .eq('id', pack.active_version_id)
    .maybeSingle()

  if (error) throw error
  return data as RipPackVersion | null
}

// ─── Transaction helpers ──────────────────────────────────────────────────────

export async function getTransactionById(
  transactionId: string,
  userId: string,
): Promise<RipTransaction | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('rip_transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as RipTransaction | null
}

export async function getTransactionByIdempotencyKey(
  key: string,
): Promise<RipTransaction | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('rip_transactions')
    .select('*')
    .eq('idempotency_key', key)
    .maybeSingle()

  if (error) throw error
  return data as RipTransaction | null
}

export async function getRipResultForTransaction(
  transactionId: string,
  userId: string,
): Promise<RipResult | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('rip_results')
    .select('*')
    .eq('transaction_id', transactionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as RipResult | null
}

// ─── Digital inventory helpers ────────────────────────────────────────────────

export async function getUserVaultItems(
  userId: string,
): Promise<DigitalInventoryItem[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('digital_inventory')
    .select('*, physical:physical_inventory_id(*)')
    .eq('user_id', userId)
    .in('status', ['available', 'vaulted'])
    .order('acquired_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as DigitalInventoryItem[]
}

// ─── Audit helpers ────────────────────────────────────────────────────────────

export async function writeAuditLog(entry: {
  event_type: string
  transaction_id?: string
  user_id?: string
  admin_id?: string
  pack_id?: string
  physical_inventory_id?: string
  digital_inventory_id?: string
  payload?: Record<string, unknown>
  ip_address?: string
}): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('rip_audit_logs').insert({
    ...entry,
    payload: entry.payload ?? {},
  })
  // Errors are intentionally swallowed — audit failure must never block the user flow.
  // Operators should monitor the rip_audit_logs table for completeness.
}

// ─── Pricing snapshot ─────────────────────────────────────────────────────────

export async function recordPricingSnapshot(
  ripResultId: string,
  cardName: string,
  setName: string | null,
): Promise<void> {
  try {
    const price = await fetchCardPrice(cardName, setName ?? '')
    if (!price) return

    const supabase = createAdminClient()
    await supabase.from('rip_pricing_snapshots').insert({
      rip_result_id: ripResultId,
      card_name: cardName,
      set_name: setName,
      market_price: price.marketPrice ?? null,
      low_price: price.lowPrice ?? null,
      high_price: price.highPrice ?? null,
      source: price.source ?? 'unknown',
    })
  } catch {
    // Non-fatal — pricing is best-effort
  }
}

// ─── Per-user pack limit check ────────────────────────────────────────────────

export async function checkUserPackLimit(
  userId: string,
  packId: string,
  maxPerUser: number | null,
): Promise<{ allowed: boolean; count: number }> {
  if (!maxPerUser) return { allowed: true, count: 0 }

  const supabase = createAdminClient()
  const { count, error } = await supabase
    .from('rip_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('pack_id', packId)
    .in('status', ['paid', 'allocating', 'allocated', 'revealed', 'completed'])

  if (error) throw error

  const current = count ?? 0
  return { allowed: current < maxPerUser, count: current }
}
