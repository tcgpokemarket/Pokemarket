"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CartItem = {
  title: string;
  price: number;
  quantity: number;
};

const STORAGE_KEY = "tcgpokemarket-cart";

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
    } catch {
      setItems([]);
    }
  }, []);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <main className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-black">Checkout</h1>

        {items.length === 0 ? (
          <>
            <p className="mt-4 text-gray-400">Your cart is empty.</p>
            <Link href="/listings" className="mt-6 inline-block rounded-xl border border-white/10 px-4 py-2">
              Browse listings
            </Link>
          </>
        ) : (
          <>
            <div className="mt-6 space-y-3">
              {items.map((item, index) => (
                <div key={index} className="rounded-xl border border-white/10 p-4">
                  <div className="flex justify-between">
                    <span>{item.title}</span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-white/10 pt-4 text-xl font-bold">
              Total: ${total.toFixed(2)}
            </div>

            <Link href="/checkout/payment" className="mt-6 inline-block rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black">
              Continue to payment
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
