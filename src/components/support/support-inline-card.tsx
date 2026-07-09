import Link from "next/link";

export default function SupportInlineCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link href={href} className="block rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-yellow-400/40 hover:bg-white/10">
      <div className="text-xs uppercase tracking-[0.3em] text-yellow-400">Support</div>
      <div className="mt-2 text-lg font-black text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-gray-300">{description}</p>
      <div className="mt-4 text-sm font-semibold text-yellow-400">Open support →</div>
    </Link>
  );
}
