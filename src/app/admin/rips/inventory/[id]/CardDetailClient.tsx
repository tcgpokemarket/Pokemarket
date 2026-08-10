'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface CardDetail {
  id: string; card_name: string; set_name: string | null; set_id: string | null
  card_number: string | null; card_id: string | null; language: string; condition: string
  grade: string | null; grade_company: string | null; certification_number: string | null
  image_url: string | null; market_value: number | null; acquisition_cost: number | null
  warehouse_location: string | null; inventory_status: string; notes: string | null
  pack_id: string | null; pack_version_id: string | null
  pack: { id: string; name: string; status: string } | null
  version: { id: string; version_number: number } | null
  created_at: string; updated_at: string
}

interface AuditLog {
  id: string; event_type: string; admin_id: string | null
  payload: Record<string, unknown>; created_at: string
}

interface PriceSnapshot {
  id: string; card_name: string; source: string
  market_price: number | null; low_price: number | null; high_price: number | null
  recorded_at: string
}

interface RipResult {
  id: string; transaction_id: string
  transaction: { id: string; status: string; created_at: string; user_id: string } | null
}

interface Pack { id: string; name: string; status: string; versions: { id: string; version_number: number }[] }

const STATUS_COLOR: Record<string, string> = {
  available: 'bg-green-500/10 text-green-400 border-green-500/30',
  allocated: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  shipped: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  sold: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  destroyed: 'bg-red-500/10 text-red-400 border-red-500/30',
  returned: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
}

export default function CardDetailClient({ id }: { id: string }) {
  const [card, setCard] = useState<CardDetail | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [pricingSnapshots, setPricingSnapshots] = useState<PriceSnapshot[]>([])
  const [ripResult, setRipResult] = useState<RipResult | null>(null)
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<CardDetail>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Image upload state
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  // Status override
  const [showStatusModal, setShowStatusModal] = useState(false)

  const loadCard = useCallback(async () => {
    setLoading(true)
    const [detailRes, packsRes] = await Promise.all([
      fetch(`/api/admin/rips/inventory/${id}`),
      fetch('/api/admin/rips/packs'),
    ])

    if (!detailRes.ok) {
      const d = await detailRes.json()
      setError(d.error ?? 'Failed to load card.')
      setLoading(false)
      return
    }

    const detail = await detailRes.json()
    setCard(detail.card)
    setAuditLogs(detail.auditLogs ?? [])
    setPricingSnapshots(detail.pricingSnapshots ?? [])
    setRipResult(detail.ripResult)

    if (packsRes.ok) {
      const pd = await packsRes.json()
      setPacks(pd.packs ?? [])
    }

    setLoading(false)
  }, [id])

  useEffect(() => { loadCard() }, [loadCard])

  const startEdit = () => {
    if (!card) return
    setEditForm({
      card_name: card.card_name,
      set_name: card.set_name ?? '',
      card_number: card.card_number ?? '',
      card_id: card.card_id ?? '',
      language: card.language,
      condition: card.condition,
      grade: card.grade ?? '',
      grade_company: card.grade_company ?? '',
      certification_number: card.certification_number ?? '',
      market_value: card.market_value ?? undefined,
      acquisition_cost: card.acquisition_cost ?? undefined,
      warehouse_location: card.warehouse_location ?? '',
      notes: card.notes ?? '',
      pack_id: card.pack_id ?? '',
      pack_version_id: card.pack_version_id ?? '',
    })
    setEditing(true)
    setSaveError(null)
  }

  const handleSave = async () => {
    setSaving(true); setSaveError(null)
    const res = await fetch(`/api/admin/rips/inventory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editForm,
        pack_id: editForm.pack_id || null,
        pack_version_id: editForm.pack_version_id || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setSaveError(data.error ?? 'Save failed.'); setSaving(false); return }
    setCard(data.card)
    setEditing(false)
    setSaving(false)
    loadCard()
  }

  const handleImageUpload = async (file: File) => {
    if (!card) return
    setUploadingImage(true); setImageError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('inventory_id', card.id)
    const res = await fetch('/api/admin/rips/inventory/upload-image', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) { setImageError(data.error ?? 'Upload failed.'); setUploadingImage(false); return }
    setCard((prev) => prev ? { ...prev, image_url: data.url } : prev)
    setUploadingImage(false)
    loadCard()
  }

  const handleStatusChange = async (newStatus: string, adminOverride = false) => {
    const res = await fetch(`/api/admin/rips/inventory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventory_status: newStatus, admin_override: adminOverride }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (data.requires_override) { setShowStatusModal(true); return }
      setSaveError(data.error ?? 'Status change failed.')
      return
    }
    setCard(data.card)
    setShowStatusModal(false)
    loadCard()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a15]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
      </div>
    )
  }

  if (error || !card) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a15] text-white">
        <p className="text-red-400">{error ?? 'Card not found.'}</p>
        <Link href="/admin/rips/inventory" className="text-sm text-yellow-400 hover:underline">
          Back to Inventory
        </Link>
      </div>
    )
  }

  const statusColors = STATUS_COLOR[card.inventory_status] ?? 'bg-white/5 text-gray-400 border-white/10'
  const selectedPack = packs.find((p) => p.id === (editForm.pack_id || card.pack_id))

  return (
    <div className="min-h-screen bg-[#0a0a15] text-white">
      <div className="mx-auto max-w-5xl px-4 py-10">

        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs text-gray-500">
          <Link href="/admin" className="hover:text-gray-300">Admin</Link>
          <span>›</span>
          <Link href="/admin/rips" className="hover:text-gray-300">Rips</Link>
          <span>›</span>
          <Link href="/admin/rips/inventory" className="hover:text-gray-300">Inventory</Link>
          <span>›</span>
          <span className="text-yellow-400 truncate max-w-48">{card.card_name}</span>
        </div>

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">{card.card_name}</h1>
            {card.set_name && (
              <p className="mt-1 text-gray-400">{card.set_name}{card.card_number ? ` — #${card.card_number}` : ''}</p>
            )}
            <div className="mt-3 flex items-center gap-3">
              <span className={`inline-block rounded-full border px-3 py-1 text-xs font-bold tracking-widest ${statusColors}`}>
                {card.inventory_status === 'destroyed' ? 'LOCKED' : card.inventory_status.toUpperCase()}
              </span>
              {card.grade && (
                <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-400">
                  {card.grade_company} {card.grade}
                </span>
              )}
            </div>
          </div>
          {!editing && (
            <button
              onClick={startEdit}
              className="shrink-0 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/5"
            >
              Edit Card
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-1">

            {/* Image */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Card Image</p>
              {card.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.image_url} alt={card.card_name} className="w-full rounded-xl object-cover" />
              ) : (
                <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-white/5 text-4xl text-gray-600">
                  ◈
                </div>
              )}
              {imageError && <p className="mt-2 text-xs text-red-400">{imageError}</p>}
              <label className={`mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs font-semibold transition hover:bg-white/5 ${uploadingImage ? 'opacity-50' : ''}`}>
                {uploadingImage ? 'Uploading…' : (card.image_url ? 'Replace Image' : 'Upload Image')}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingImage}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }}
                />
              </label>
            </div>

            {/* Financials */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Financials</p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Market value</span>
                  <span className="font-bold text-white">
                    {card.market_value != null ? `$${card.market_value.toFixed(2)}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Acquisition cost</span>
                  <span className="font-bold text-white">
                    {card.acquisition_cost != null ? `$${card.acquisition_cost.toFixed(2)}` : '—'}
                  </span>
                </div>
                {card.market_value != null && card.acquisition_cost != null && (
                  <div className="flex justify-between border-t border-white/10 pt-3">
                    <span className="text-sm text-gray-400">Margin</span>
                    <span className={`font-bold ${card.market_value - card.acquisition_cost >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {card.market_value - card.acquisition_cost >= 0 ? '+' : ''}
                      ${(card.market_value - card.acquisition_cost).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Price history */}
            {pricingSnapshots.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Price History</p>
                <div className="space-y-2">
                  {pricingSnapshots.slice(0, 5).map((snap) => (
                    <div key={snap.id} className="flex justify-between text-sm">
                      <span className="text-gray-400">{snap.source}</span>
                      <span className="text-white">{snap.market_price != null ? `$${snap.market_price.toFixed(2)}` : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rip result */}
            {ripResult && (
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-purple-400">Used in Rip</p>
                <p className="text-xs text-gray-400">Transaction</p>
                <p className="mt-1 truncate font-mono text-xs text-white">{ripResult.transaction_id}</p>
                {ripResult.transaction && (
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(ripResult.transaction.created_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6 lg:col-span-2">

            {/* Details / Edit form */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Card Details</p>
                {editing && (
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs transition hover:bg-white/5">Cancel</button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-yellow-300 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {saveError && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {saveError}
                </div>
              )}

              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Card name *">
                      <input value={editForm.card_name ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, card_name: e.target.value }))} className={inputClass} />
                    </FormField>
                    <FormField label="Card ID">
                      <input value={editForm.card_id ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, card_id: e.target.value }))} className={inputClass} placeholder="sv3pt5-54" />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Set name">
                      <input value={editForm.set_name ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, set_name: e.target.value }))} className={inputClass} />
                    </FormField>
                    <FormField label="Card number">
                      <input value={editForm.card_number ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, card_number: e.target.value }))} className={inputClass} />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField label="Language">
                      <select value={editForm.language} onChange={(e) => setEditForm((p) => ({ ...p, language: e.target.value }))} className={selectClass}>
                        {['en', 'jp', 'de', 'fr', 'es', 'it', 'pt', 'ko'].map((l) => <option key={l}>{l}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Condition">
                      <select value={editForm.condition} onChange={(e) => setEditForm((p) => ({ ...p, condition: e.target.value }))} className={selectClass}>
                        {['NM', 'LP', 'MP', 'HP', 'DMG'].map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Grade">
                      <input value={editForm.grade ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, grade: e.target.value }))} className={inputClass} placeholder="9.5" />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Grade company">
                      <input value={editForm.grade_company ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, grade_company: e.target.value }))} className={inputClass} />
                    </FormField>
                    <FormField label="Certification #">
                      <input value={editForm.certification_number ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, certification_number: e.target.value }))} className={inputClass} />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Market value ($)">
                      <input value={editForm.market_value ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, market_value: e.target.value ? parseFloat(e.target.value) : undefined }))} className={inputClass} type="number" min="0" step="0.01" />
                    </FormField>
                    <FormField label="Acquisition cost ($)">
                      <input value={editForm.acquisition_cost ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, acquisition_cost: e.target.value ? parseFloat(e.target.value) : undefined }))} className={inputClass} type="number" min="0" step="0.01" />
                    </FormField>
                  </div>
                  <FormField label="Warehouse location">
                    <input value={editForm.warehouse_location ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, warehouse_location: e.target.value }))} className={inputClass} placeholder="BIN-A4" />
                  </FormField>

                  {/* Pack re-assignment */}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Pack Assignment</p>
                    <FormField label="Pack">
                      <select value={editForm.pack_id ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, pack_id: e.target.value, pack_version_id: '' }))} className={selectClass}>
                        <option value="">Unassigned</option>
                        {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </FormField>
                    {selectedPack && (
                      <FormField label="Version">
                        <select value={editForm.pack_version_id ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, pack_version_id: e.target.value }))} className={selectClass}>
                          <option value="">Select version</option>
                          {selectedPack.versions.map((v) => <option key={v.id} value={v.id}>Version {v.version_number}</option>)}
                        </select>
                      </FormField>
                    )}
                  </div>

                  <FormField label="Notes">
                    <textarea value={editForm.notes ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} rows={3} className={inputClass + ' resize-none'} />
                  </FormField>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <Detail label="Language" value={card.language.toUpperCase()} />
                  <Detail label="Condition" value={card.condition} />
                  {card.grade && <Detail label="Grade" value={`${card.grade_company ?? ''} ${card.grade}`.trim()} />}
                  {card.certification_number && <Detail label="Cert #" value={card.certification_number} />}
                  <Detail label="Location" value={card.warehouse_location ?? '—'} />
                  {card.pack && <Detail label="Pack" value={card.pack.name} />}
                  {card.version && <Detail label="Version" value={`v${card.version.version_number}`} />}
                  {card.notes && <div className="col-span-2"><Detail label="Notes" value={card.notes} /></div>}
                  <Detail label="Added" value={new Date(card.created_at).toLocaleDateString()} />
                  <Detail label="Updated" value={new Date(card.updated_at).toLocaleDateString()} />
                </div>
              )}
            </div>

            {/* Status management */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Status Management</p>
              <p className="mb-4 text-sm text-gray-400">
                Current status: <span className="font-bold text-white">{card.inventory_status}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {['available', 'returned', 'destroyed'].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={card.inventory_status === s || !!ripResult}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-30 ${
                      s === 'destroyed' ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-white/10 text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    {s === 'destroyed' ? 'Lock' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              {ripResult && (
                <p className="mt-3 text-xs text-gray-500">Status changes are locked — this card was used in a rip.</p>
              )}
            </div>

            {/* Audit log */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">
                Audit History ({auditLogs.length})
              </p>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-gray-500">No audit events yet.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 text-sm">
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-yellow-400/50" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-yellow-400">{log.event_type}</span>
                          <span className="text-xs text-gray-600">{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        {log.payload && Object.keys(log.payload).length > 0 && (
                          <pre className="mt-1 max-h-20 overflow-y-auto rounded-lg bg-black/20 p-2 text-[10px] text-gray-400">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin override modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-[#0f0f1a] p-6">
            <h2 className="mb-3 text-lg font-black text-white">Admin Override Required</h2>
            <p className="mb-5 text-sm text-gray-400">
              This card is in a protected status. Changing it requires an admin override and will be permanently recorded in the audit log.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowStatusModal(false)} className="flex-1 rounded-xl border border-white/10 py-2 text-sm transition hover:bg-white/5">
                Cancel
              </button>
              <button
                onClick={() => { setShowStatusModal(false) }}
                className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-bold text-white transition hover:bg-red-400"
              >
                Override & Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 font-semibold text-white">{value}</p>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

const inputClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-yellow-400/40'
const selectClass = 'w-full rounded-lg border border-white/10 bg-[#0a0a15] px-3 py-2 text-sm text-white outline-none focus:border-yellow-400/40'
