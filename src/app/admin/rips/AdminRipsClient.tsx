'use client'

import { useState } from 'react'

interface Pack {
  id: string
  name: string
  status: string
  price: number
  available_quantity: number
  inventory_count: number
  sort_order: number
}

interface Transaction {
  id: string
  status: string
  amount: number
  created_at: string
  user_id: string
  pack_id: string
  profiles?: { email?: string } | null
}

interface Props {
  packs: Pack[]
  recentTransactions: Transaction[]
  stats: { total: number; revealed: number }
}

type Tab = 'overview' | 'packs' | 'transactions' | 'inventory'

export default function AdminRipsClient({ packs, recentTransactions, stats }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'packs', label: 'Packs' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'inventory', label: 'Inventory' },
  ]

  return (
    <main className="min-h-screen bg-[#0a0a15] text-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <header className="mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-yellow-400">
            Admin
          </p>
          <h1 className="text-3xl font-black">Poké Rips</h1>
        </header>

        {/* Tabs */}
        <div className="mb-8 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition
                ${activeTab === tab.id
                  ? 'bg-yellow-400 text-black'
                  : 'text-gray-400 hover:text-white'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <OverviewTab packs={packs} stats={stats} recentTransactions={recentTransactions} />
        )}
        {activeTab === 'packs' && <PacksTab packs={packs} />}
        {activeTab === 'transactions' && <TransactionsTab transactions={recentTransactions} />}
        {activeTab === 'inventory' && <InventoryTab />}
      </div>
    </main>
  )
}

function OverviewTab({
  packs,
  stats,
  recentTransactions,
}: {
  packs: Pack[]
  stats: { total: number; revealed: number }
  recentTransactions: Transaction[]
}) {
  const activePacks = packs.filter((p) => p.status === 'active')
  const totalAvailable = packs.reduce((s, p) => s + p.available_quantity, 0)

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Active packs" value={activePacks.length} />
        <StatCard label="Available inventory" value={totalAvailable} />
        <StatCard label="Total transactions" value={stats.total} />
        <StatCard label="Completed rips" value={stats.revealed} />
      </div>

      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">
          Recent transactions
        </h2>
        <TransactionTable transactions={recentTransactions.slice(0, 10)} />
      </div>
    </div>
  )
}

function PacksTab({ packs }: { packs: Pack[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-white">Packs ({packs.length})</h2>
        <p className="text-xs text-gray-500">
          Create packs via Supabase or the admin API.
        </p>
      </div>

      {packs.length === 0 ? (
        <EmptyCard message="No packs created yet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-gray-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {packs.map((pack) => (
                <tr key={pack.id} className="text-gray-300">
                  <td className="px-4 py-3 font-medium text-white">{pack.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={pack.status} />
                  </td>
                  <td className="px-4 py-3">${pack.price.toFixed(2)}</td>
                  <td className="px-4 py-3">{pack.available_quantity}</td>
                  <td className="px-4 py-3">{pack.inventory_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TransactionsTab({ transactions }: { transactions: Transaction[] }) {
  return (
    <div>
      <h2 className="mb-4 font-bold text-white">
        Recent transactions ({transactions.length})
      </h2>
      {transactions.length === 0 ? (
        <EmptyCard message="No transactions yet." />
      ) : (
        <TransactionTable transactions={transactions} />
      )}
    </div>
  )
}

function InventoryTab() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
      <p className="text-sm text-gray-400">
        Manage physical inventory via Supabase table editor or the CSV import tool.
        Each row in <code className="rounded bg-white/10 px-1 text-xs">rip_physical_inventory</code> represents one physical card.
      </p>
    </div>
  )
}

function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs text-gray-500">
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {transactions.map((tx) => (
            <tr key={tx.id} className="text-gray-300">
              <td className="px-4 py-3 font-mono text-xs text-gray-500">
                {tx.id.slice(0, 8)}…
              </td>
              <td className="px-4 py-3 text-xs">
                {tx.profiles?.email ?? tx.user_id.slice(0, 8)}…
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={tx.status} />
              </td>
              <td className="px-4 py-3">${tx.amount.toFixed(2)}</td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {new Date(tx.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value.toLocaleString()}</p>
    </div>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 py-12 text-center text-sm text-gray-500">
      {message}
    </div>
  )
}

const statusColors: Record<string, string> = {
  active: 'text-green-400 bg-green-400/10 border-green-400/30',
  draft: 'text-gray-400 bg-gray-400/10 border-gray-400/30',
  paused: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  archived: 'text-gray-600 bg-gray-600/10 border-gray-600/30',
  completed: 'text-green-400 bg-green-400/10 border-green-400/30',
  revealed: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  paid: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  allocated: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  failed: 'text-red-400 bg-red-400/10 border-red-400/30',
  refunded: 'text-red-400 bg-red-400/10 border-red-400/30',
  pending: 'text-gray-400 bg-gray-400/10 border-gray-400/30',
  payment_processing: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
}

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] ?? 'text-gray-400 bg-gray-400/10 border-gray-400/30'
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${colors}`}>
      {status}
    </span>
  )
}
