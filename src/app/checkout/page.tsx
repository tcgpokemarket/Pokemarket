import Link from "next/link";

export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-black">Checkout</h1>
        <p className="mt-4 text-gray-400">
          Checkout flow is ready for payment, order creation, and escrow connection.
        </p>
        <Link href="/cart" className="mt-6 inline-block rounded-xl border border-white/10 px-4 py-2">
          Return to cart
        </Link>
      </div>
    </main>
  );
}
