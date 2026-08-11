"use client";

import Link from "next/link";

export default function AdminRipsClient() {
  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Rips</h1>
          <p className="text-sm text-muted-foreground">Manage packs, inventory, uploads, transactions, and results.</p>
        </div>
        <Link href="/admin/rips/uploader" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Rips Uploader
        </Link>
      </div>
      <section className="grid gap-4 md:grid-cols-4">
        <Link href="/admin/rips/uploader" className="rounded-lg border p-4 hover:bg-muted/50">
          <div className="font-medium">Upload Inventory</div>
          <div className="text-sm text-muted-foreground">Open the existing Rips inventory uploader.</div>
        </Link>
        <Link href="/admin/rips/inventory" className="rounded-lg border p-4 hover:bg-muted/50">
          <div className="font-medium">Inventory</div>
          <div className="text-sm text-muted-foreground">View and manage physical Rips inventory.</div>
        </Link>
        <Link href="/admin/rips" className="rounded-lg border p-4 hover:bg-muted/50">
          <div className="font-medium">Packs</div>
          <div className="text-sm text-muted-foreground">Manage Rips packs and versions.</div>
        </Link>
        <Link href="/admin/rips/inventory" className="rounded-lg border p-4 hover:bg-muted/50">
          <div className="font-medium">Inventory Records</div>
          <div className="text-sm text-muted-foreground">Review imported cards and inventory status.</div>
        </Link>
      </section>
    </main>
  );
}
