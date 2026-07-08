import type { Metadata } from "next";
import CartClient from "@/components/cart/CartClient";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review your Pokémon card cart before checkout.",
};

export default function CartPage() {
  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <CartClient />
      </div>
    </div>
  );
}
