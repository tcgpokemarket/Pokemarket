'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  total: number; available: number; allocated: number
  sold: number; shipped: number; locked: number; unassigned: number; vaulted?: number
}

interface Pack { id: string; name: string; status: string; versions: Version[] }
interface Version { id: string; pack_id: string; version_number: number }

interface InventoryCard {
  id: string; card_name: string; set_name: string | null; card_number: string | null
  rarity: string | null; language: string; condition: string; grade: string | null
  grade_company: string | null; certification_number: string | null
  image_url: string | null; market_value: number | null; acquisition_cost: number | null
  inventory_status: string; warehouse_location: string | null
  pack: { name: string } | null; version: { version_number: number } | null
  pack_id: string | null; pack_version_id: string | null; created_at: string
}

interface CSVValidation {
  total: number
  valid: { index: number; row: Record<string, string>; errors: string[] }[]
  invalid: { index: number; row: Record<string, string>; errors: string[] }[]
  duplicates: { index: number; row: Record<string, string>; errors: string[] }[]
}

// ─── Status colours ───────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  available: 'bg-green-500/10 text-green-400 border-green-500/30',
  allocated: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  shipped: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  sold: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  destroyed: 'bg-red-500/10 text-red-400 border-red-500/30',
  returned: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLOR[status] ?? 'bg-white/5 text-gray-400 border-white/10'
  const label = status === 'destroyed' ? 'LOCKED' : status.toUpperCase()
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest ${colors}`}>
      {label}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function InventoryDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [cards, setCards] = useState<InventoryCard[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [packs, setPacks] = useState<Pack[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [packFilter, setPackFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Modals
  const [showUpload, setShowUpload] = useState(false)
  const [showAddCard, setShowAddCard] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [showBulkAction, setShowBulkAction] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/admin/rips/inventory/stats')
    if (res.ok) setStats(await res.json())
  }, [])

  const loadPacks = useCallback(async () => {
    const res = await fetch('/api/admin/rips/packs')
    if (res.ok) {
      const d = await res.json()
      setPacks(d.packs ?? [])
    }
  }, [])

  const loadCards = useCallback(async (p: number) => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(p), limit: '50',
      sort: sortField, order: sortOrder,
    })
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    if (packFilter) params.set('pack_id', packFilter)
    if (assignedFilter) params.set('assigned', assignedFilter)

    const res = await fetch(`/api/admin/rips/inventory?${params}`)
    if (res.ok) {
      const d = await res.json()
      setCards(d.inventory ?? [])
      setTotal(d.total ?? 0)
      setPages(d.pages ?? 1)
    }
    setLoading(false)
  }, [search, statusFilter, packFilter, assignedFilter, sortField, sortOrder])

  useEffect(() => { loadStats(); loadPacks() }, [loadStats, loadPacks])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setPage(1); loadCards(1) }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search, statusFilter, packFilter, assignedFilter, sortField, sortOrder, loadCards])

  useEffect(() => { loadCards(page) }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Selection ─────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === cards.length ? new Set() : new Set(cards.map((c) => c.id)),
    )

  const clearSelection = () => setSelected(new Set())

  // ─── Sort toggle ───────────────────────────────────────────────────────────

  const handleSort = (field: string) => {
    if (sortField === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortOrder('asc') }
  }

  const refresh = () => { loadStats(); loadCards(page) }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a15] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
              <Link href="/admin" className="hover:text-gray-300">Admin</Link>
              <span>›</span>
              <Link href="/admin/rips" className="hover:text-gray-300">Rips</Link>
              <span>›</span>
              <span className="text-yellow-400">Card Inventory</span>
            </div>
            <h1 className="text-3xl font-black">Card Inventory</h1>
            <p className="mt-1 text-sm text-gray-500">{total.toLocaleString()} total cards</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddCard(true)}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/5"
            >
              + Add Card
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="rounded-xl bg-yellow-400 px-5 py-2 text-sm font-black text-black transition hover:bg-yellow-300"
            >
              Upload Cards
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {[
              { label: 'Total', value: stats.total },
              { label: 'Available', value: stats.available, color: 'text-green-400' },
              { label: 'Allocated', value: stats.allocated, color: 'text-purple-400' },
              { label: 'Unassigned', value: stats.unassigned, color: 'text-yellow-400' },
              { label: 'Vaulted', value: stats.vaulted ?? 0, color: 'text-blue-400' },
              { label: 'Sold', value: stats.sold },
              { label: 'Shipped', value: stats.shipped },
              { label: 'Locked', value: stats.locked },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`mt-1 text-xl font-black ${s.color ?? 'text-white'}`}>{s.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards, set, cert #…"
            className="flex-1 min-w-48 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-yellow-400/40"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0a0a15] px-3 py-2 text-sm text-white"
          >
            <option value="">All statuses</option>
            {['available', 'allocated', 'shipped', 'sold', 'returned', 'destroyed'].map((s) => (
              <option key={s} value={s}>{s === 'destroyed' ? 'locked' : s}</option>
            ))}
          </select>
          <select
            value={packFilter}
            onChange={(e) => setPackFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0a0a15] px-3 py-2 text-sm text-white"
          >
            <option value="">All packs</option>
            {packs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0a0a15] px-3 py-2 text-sm text-white"
          >
            <option value="">Assigned + Unassigned</option>
            <option value="yes">Assigned only</option>
            <option value="no">Unassigned only</option>
          </select>
        </div>

        {/* Bulk toolbar */}
        {selected.size > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3">
            <span className="text-sm font-bold text-yellow-300">{selected.size} selected</span>
            <button
              onClick={() => setShowAssign(true)}
              className="rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-yellow-300"
            >
              Assign to Pack
            </button>
            <button
              onClick={() => setShowBulkAction(true)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/5"
            >
              Bulk Actions
            </button>
            <button onClick={clearSelection} className="ml-auto text-xs text-gray-500 hover:text-gray-300">
              Clear
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-gray-500">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === cards.length && cards.length > 0}
                    onChange={toggleAll}
                    className="accent-yellow-400"
                  />
                </th>
                <th className="px-4 py-3 w-16">Image</th>
                <SortableHeader label="Card" field="card_name" active={sortField} order={sortOrder} onSort={handleSort} />
                <th className="px-4 py-3">Set / #</th>
                <th className="px-4 py-3">Condition</th>
                <SortableHeader label="Value" field="market_value" active={sortField} order={sortOrder} onSort={handleSort} />
                <th className="px-4 py-3">Pack</th>
                <SortableHeader label="Status" field="inventory_status" active={sortField} order={sortOrder} onSort={handleSort} />
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
              ) : cards.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <p className="text-gray-500">No cards found.</p>
                    <button
                      onClick={() => setShowUpload(true)}
                      className="mt-4 rounded-xl bg-yellow-400 px-5 py-2 text-sm font-bold text-black transition hover:bg-yellow-300"
                    >
                      Upload Cards
                    </button>
                  </td>
                </tr>
              ) : (
                cards.map((card) => (
                  <tr key={card.id} className={`transition hover:bg-white/5 ${selected.has(card.id) ? 'bg-yellow-400/5' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(card.id)}
                        onChange={() => toggleSelect(card.id)}
                        className="accent-yellow-400"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {card.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.image_url} alt={card.card_name} className="h-12 w-9 rounded object-cover" />
                      ) : (
                        <div className="flex h-12 w-9 items-center justify-center rounded border border-white/10 bg-white/5 text-gray-600">◈</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{card.card_name}</p>
                      {card.grade && (
                        <p className="text-xs text-yellow-400">{card.grade_company} {card.grade}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      <p>{card.set_name ?? '—'}</p>
                      {card.card_number && <p className="text-xs">#{card.card_number}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{card.condition}</td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {card.market_value != null ? `$${card.market_value.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {card.pack ? (
                        <>
                          <p className="text-white">{card.pack.name}</p>
                          {card.version && <p>v{card.version.version_number}</p>}
                        </>
                      ) : (
                        <span className="text-yellow-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={card.inventory_status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{card.warehouse_location ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/rips/inventory/${card.id}`}
                        className="rounded-lg border border-white/10 px-3 py-1 text-xs transition hover:border-yellow-400/40 hover:text-yellow-300"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>Page {page} of {pages} — {total.toLocaleString()} cards</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-white/10 px-3 py-1 transition hover:bg-white/5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="rounded-lg border border-white/10 px-3 py-1 transition hover:bg-white/5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showUpload && (
        <CSVUploadModal
          packs={packs}
          onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); refresh() }}
        />
      )}
      {showAddCard && (
        <AddCardModal
          packs={packs}
          onClose={() => setShowAddCard(false)}
          onDone={() => { setShowAddCard(false); refresh() }}
        />
      )}
      {showAssign && (
        <AssignPackModal
          ids={Array.from(selected)}
          packs={packs}
          onClose={() => setShowAssign(false)}
          onDone={() => { setShowAssign(false); clearSelection(); refresh() }}
        />
      )}
      {showBulkAction && (
        <BulkActionModal
          ids={Array.from(selected)}
          onClose={() => setShowBulkAction(false)}
          onDone={() => { setShowBulkAction(false); clearSelection(); refresh() }}
        />
      )}
    </div>
  )
}

// ─── Sortable header ──────────────────────────────────────────────────────────
function SortableHeader({ label, field, active, order, onSort }: {
  label: string; field: string; active: string; order: string; onSort: (f: string) => void
}) {
  const isActive = active === field
  return (
    <th className="px-4 py-3 cursor-pointer select-none hover:text-white" onClick={() => onSort(field)}>
      <span className={isActive ? 'text-yellow-400' : ''}>{label}</span>
      {isActive && <span className="ml-1">{order === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}

// ─── CSV Upload Modal ─────────────────────────────────────────────────────────
function CSVUploadModal({ packs, onClose, onDone }: { packs: Pack[]; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<'upload' | 'validate' | 'preview' | 'importing' | 'done'>('upload')
  const [csvText, setCsvText] = useState('')
  const [validation, setValidation] = useState<CSVValidation | null>(null)
  const [result, setResult] = useState<{ imported: number; rejected: number; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => setCsvText(String(e.target?.result ?? ''))
    reader.readAsText(file)
  }

  const handleValidate = async () => {
    setLoading(true); setError(null)
    const res = await fetch('/api/admin/rips/inventory/csv-validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvText }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    setValidation(data)
    setStep('preview')
    setLoading(false)
  }

  const handleImport = async () => {
    setStep('importing'); setError(null)
    const res = await fetch('/api/admin/rips/inventory/csv-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvText }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Import failed.'); setStep('preview'); return }
    setResult(data)
    setStep('done')
  }

  return (
    <Modal title="Upload Cards via CSV" onClose={onClose}>
      {step === 'upload' && (
        <div className="space-y-5">
          <div
            className="cursor-pointer rounded-xl border-2 border-dashed border-white/20 bg-white/5 p-10 text-center transition hover:border-yellow-400/40"
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { handleFile(f); setStep('validate') } }}
            onDragOver={(e) => e.preventDefault()}
          >
            <p className="text-3xl mb-2">📁</p>
            <p className="font-bold text-white">Drop CSV here</p>
            <p className="mt-1 text-xs text-gray-500">or</p>
            <label className="mt-3 inline-block cursor-pointer rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5">
              Choose file
              <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFile(f); setStep('validate') } }} />
            </label>
          </div>
          <a
            href="/api/admin/rips/inventory/csv-template"
            className="flex items-center gap-2 text-sm text-yellow-400 hover:underline"
          >
            ↓ Download CSV template
          </a>
        </div>
      )}

      {step === 'validate' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-bold text-white">CSV loaded</p>
            <p className="mt-1 text-xs text-gray-400">{csvText.split('\n').length - 1} data rows detected</p>
          </div>
          {error && <ErrorBanner message={error} />}
          <div className="flex gap-3">
            <button onClick={() => setStep('upload')} className="flex-1 rounded-xl border border-white/10 py-2 text-sm transition hover:bg-white/5">
              Change file
            </button>
            <button
              onClick={handleValidate}
              disabled={loading}
              className="flex-1 rounded-xl bg-yellow-400 py-2 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:opacity-50"
            >
              {loading ? 'Validating…' : 'Validate'}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && validation && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total', value: validation.total },
              { label: 'Valid', value: validation.valid.length, color: 'text-green-400' },
              { label: 'Invalid', value: validation.invalid.length, color: 'text-red-400' },
              { label: 'Duplicates', value: validation.duplicates.length, color: 'text-yellow-400' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-xl font-black ${s.color ?? 'text-white'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {validation.invalid.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-xs space-y-1">
              <p className="font-bold text-red-400">Errors to fix:</p>
              {validation.invalid.slice(0, 20).map((r) => (
                <p key={r.index} className="text-red-300">Row {r.index}: {r.errors.join('; ')}</p>
              ))}
            </div>
          )}

          {validation.duplicates.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-xs space-y-1">
              <p className="font-bold text-yellow-400">Duplicates (will be skipped):</p>
              {validation.duplicates.slice(0, 10).map((r) => (
                <p key={r.index} className="text-yellow-300">Row {r.index}: {r.errors.join('; ')}</p>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('upload')} className="flex-1 rounded-xl border border-white/10 py-2 text-sm transition hover:bg-white/5">
              Restart
            </button>
            <button
              onClick={handleImport}
              disabled={validation.valid.length === 0}
              className="flex-1 rounded-xl bg-yellow-400 py-2 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:opacity-40"
            >
              Import {validation.valid.length} Cards
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex flex-col items-center gap-4 py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
          <p className="text-sm text-gray-400">Importing cards…</p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-4 text-center">
          <p className="text-3xl">✓</p>
          <p className="text-xl font-black text-white">{result.imported} cards imported</p>
          {result.rejected > 0 && <p className="text-sm text-red-400">{result.rejected} cards rejected</p>}
          {result.errors.length > 0 && (
            <div className="text-left rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300 max-h-32 overflow-y-auto">
              {result.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <button onClick={onDone} className="w-full rounded-xl bg-yellow-400 py-2 font-bold text-black transition hover:bg-yellow-300">
            View Inventory
          </button>
        </div>
      )}
    </Modal>
  )
}

// ─── Add Card Modal ───────────────────────────────────────────────────────────
function AddCardModal({ packs, onClose, onDone }: { packs: Pack[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    card_name: '', card_id: '', set_name: '', card_number: '', language: 'en',
    condition: 'NM', grade: '', grade_company: '', certification_number: '',
    market_value: '', acquisition_cost: '', warehouse_location: '', notes: '',
    pack_id: '', pack_version_id: '', image_url: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const field = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const selectedPack = packs.find((p) => p.id === form.pack_id)

  const handleImageFile = (file: File) => {
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!form.card_name.trim()) { setError('Card name is required.'); return }
    setLoading(true); setError(null)

    let imageUrl = form.image_url

    // Upload image first if provided
    if (imageFile) {
      const fd = new FormData()
      fd.append('file', imageFile)
      const imgRes = await fetch('/api/admin/rips/inventory/upload-image', { method: 'POST', body: fd })
      if (!imgRes.ok) {
        const d = await imgRes.json()
        setError(d.error ?? 'Image upload failed.')
        setLoading(false)
        return
      }
      const imgData = await imgRes.json()
      imageUrl = imgData.url
    }

    const res = await fetch('/api/admin/rips/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        image_url: imageUrl || null,
        market_value: form.market_value ? parseFloat(form.market_value) : null,
        acquisition_cost: form.acquisition_cost ? parseFloat(form.acquisition_cost) : null,
        pack_id: form.pack_id || null,
        pack_version_id: form.pack_version_id || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to add card.'); setLoading(false); return }
    onDone()
  }

  return (
    <Modal title="Add Card" onClose={onClose}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {error && <ErrorBanner message={error} />}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Card name *" required>
            <input value={form.card_name} onChange={field('card_name')} className={inputClass} placeholder="Charizard ex" />
          </FormField>
          <FormField label="Card ID (optional)">
            <input value={form.card_id} onChange={field('card_id')} className={inputClass} placeholder="sv3pt5-54" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Set name">
            <input value={form.set_name} onChange={field('set_name')} className={inputClass} placeholder="151" />
          </FormField>
          <FormField label="Card number">
            <input value={form.card_number} onChange={field('card_number')} className={inputClass} placeholder="54" />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Language">
            <select value={form.language} onChange={field('language')} className={selectClass}>
              <option value="en">English</option>
              <option value="jp">Japanese</option>
              <option value="de">German</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="ko">Korean</option>
            </select>
          </FormField>
          <FormField label="Condition *">
            <select value={form.condition} onChange={field('condition')} className={selectClass}>
              {['NM', 'LP', 'MP', 'HP', 'DMG'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Grade">
            <input value={form.grade} onChange={field('grade')} className={inputClass} placeholder="9.5" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Grading company">
            <input value={form.grade_company} onChange={field('grade_company')} className={inputClass} placeholder="PSA, BGS, CGC…" />
          </FormField>
          <FormField label="Certification #">
            <input value={form.certification_number} onChange={field('certification_number')} className={inputClass} placeholder="12345678" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Market value ($)">
            <input value={form.market_value} onChange={field('market_value')} className={inputClass} placeholder="89.99" type="number" min="0" step="0.01" />
          </FormField>
          <FormField label="Acquisition cost ($)">
            <input value={form.acquisition_cost} onChange={field('acquisition_cost')} className={inputClass} placeholder="55.00" type="number" min="0" step="0.01" />
          </FormField>
        </div>

        <FormField label="Warehouse location">
          <input value={form.warehouse_location} onChange={field('warehouse_location')} className={inputClass} placeholder="BIN-A4" />
        </FormField>

        {/* Image upload */}
        <FormField label="Card image">
          <div className="flex items-start gap-3">
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="Preview" className="h-20 w-14 rounded object-cover border border-white/10" />
            ) : (
              <div className="flex h-20 w-14 items-center justify-center rounded border border-white/10 bg-white/5 text-2xl text-gray-600">◈</div>
            )}
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-1.5 text-xs transition hover:bg-white/5">
                Upload image
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }} />
              </label>
              <input
                value={form.image_url}
                onChange={field('image_url')}
                className={inputClass + ' text-xs'}
                placeholder="or paste image URL"
              />
            </div>
          </div>
        </FormField>

        {/* Pack assignment */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Pack Assignment (optional)</p>
          <FormField label="Pack">
            <select value={form.pack_id} onChange={(e) => setForm((prev) => ({ ...prev, pack_id: e.target.value, pack_version_id: '' }))} className={selectClass}>
              <option value="">Unassigned</option>
              {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
          {selectedPack && (
            <FormField label="Pack version">
              <select value={form.pack_version_id} onChange={field('pack_version_id')} className={selectClass}>
                <option value="">Select version</option>
                {selectedPack.versions.map((v) => (
                  <option key={v.id} value={v.id}>Version {v.version_number}</option>
                ))}
              </select>
            </FormField>
          )}
        </div>

        <FormField label="Notes">
          <textarea value={form.notes} onChange={field('notes')} rows={2} className={inputClass + ' resize-none'} />
        </FormField>
      </div>

      <div className="mt-5 flex gap-3">
        <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2 text-sm transition hover:bg-white/5">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 rounded-xl bg-yellow-400 py-2 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Add Card'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Assign Pack Modal ────────────────────────────────────────────────────────
function AssignPackModal({ ids, packs, onClose, onDone }: {
  ids: string[]; packs: Pack[]; onClose: () => void; onDone: () => void
}) {
  const [packId, setPackId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPack = packs.find((p) => p.id === packId)

  const handleAssign = async () => {
    if (!packId || !versionId) { setError('Select a pack and version.'); return }
    setLoading(true); setError(null)
    const res = await fetch('/api/admin/rips/inventory/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, pack_id: packId, pack_version_id: versionId }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to assign.'); setLoading(false); return }
    onDone()
  }

  return (
    <Modal title={`Assign ${ids.length} card${ids.length > 1 ? 's' : ''} to Pack`} onClose={onClose}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <FormField label="Pack">
          <select value={packId} onChange={(e) => { setPackId(e.target.value); setVersionId('') }} className={selectClass}>
            <option value="">Select pack…</option>
            {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormField>
        {selectedPack && (
          <FormField label="Pack version">
            <select value={versionId} onChange={(e) => setVersionId(e.target.value)} className={selectClass}>
              <option value="">Select version…</option>
              {selectedPack.versions.map((v) => (
                <option key={v.id} value={v.id}>Version {v.version_number}</option>
              ))}
            </select>
          </FormField>
        )}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2 text-sm transition hover:bg-white/5">Cancel</button>
          <button
            onClick={handleAssign}
            disabled={loading || !packId || !versionId}
            className="flex-1 rounded-xl bg-yellow-400 py-2 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:opacity-40"
          >
            {loading ? 'Assigning…' : `Assign ${ids.length} Cards`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Bulk Action Modal ────────────────────────────────────────────────────────
function BulkActionModal({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone: () => void }) {
  const [action, setAction] = useState<'lock' | 'update_location' | 'unassign'>('update_location')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApply = async () => {
    if (action === 'update_location' && !location.trim()) { setError('Location is required.'); return }
    setLoading(true); setError(null)
    const res = await fetch('/api/admin/rips/inventory/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action, location: location || undefined }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Action failed.'); setLoading(false); return }
    onDone()
  }

  return (
    <Modal title={`Bulk Action — ${ids.length} cards`} onClose={onClose}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <FormField label="Action">
          <select value={action} onChange={(e) => setAction(e.target.value as typeof action)} className={selectClass}>
            <option value="update_location">Update warehouse location</option>
            <option value="unassign">Remove pack assignment</option>
            <option value="lock">Lock inventory</option>
          </select>
        </FormField>
        {action === 'update_location' && (
          <FormField label="New location">
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} placeholder="BIN-A4" />
          </FormField>
        )}
        {action === 'lock' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            Locking prevents cards from being allocated. This action is recorded in the audit log.
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2 text-sm transition hover:bg-white/5">Cancel</button>
          <button
            onClick={handleApply}
            disabled={loading}
            className={`flex-1 rounded-xl py-2 text-sm font-bold transition disabled:opacity-40 ${action === 'lock' ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-yellow-400 text-black hover:bg-yellow-300'}`}
          >
            {loading ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0f0f1a] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 transition hover:text-white text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
      {message}
    </div>
  )
}

const inputClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-yellow-400/40'
const selectClass = 'w-full rounded-lg border border-white/10 bg-[#0a0a15] px-3 py-2 text-sm text-white outline-none focus:border-yellow-400/40'
