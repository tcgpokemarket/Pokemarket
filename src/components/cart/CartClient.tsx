"use client";

import { useEffect, useMemo, useState } from "react";
import { getCartItemTotal, type CartItem } from "@/lib/cart";

const STORAGE_KEY = "tcgpokemarket-cart";

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as CartItem[];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("tcg-cart-update"));
}

export function addToCart(item: CartItem) {
  const current = readCart();
  const existing = current.find((entry) => entry.listingId === item.listingId);
  const next = existing
    ? current.map((entry) => entry.listingId === item.listingId ? { ...entry, quantity: entry.quantity + item.quantity } : entry)
    : [...current, item];
  writeCart(next);
}

export function clearCart() {
  writeCart([]);
}

export default function CartClient() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(readCart());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("tcg-cart-update", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("tcg-cart-update", sync);
    };
  }, []);

  const total = useMemo(() => getCartItemTotal(items), [items]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-yellow-400">Cart</p>
          <h1 className="mt-2 text-3xl font-black">Your current items</h1>
        </div>
        <button onClick={() => { clearCart(); setItems([]); }} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5">
          Clear cart
        </button>
      </div>

      <div className="mt-8 space-y-4">
        {items.length ? items.map((item) => (
          <div key={item.listingId} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#13131f] p-4">
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-gray-400">Qty {item.quantity}</p>
            </div>
            <p className="font-bold text-yellow-400">${(item.price * item.quantity).toFixed(2)}</p>
          </div>
        )) : (
          <div className="rounded-2xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-400">
            Your cart is empty.
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-lg font-bold">
        <span>Total</span>
        <span>${total.toFixed(2)}</span>
      </div>
    </div>
  );
}
