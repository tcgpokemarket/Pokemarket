import Link from "next/link";

export default function SupportInlineCard({ title, description, href = "/support" }: { title: string; description: string; href?: string }) {
  return (
    <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-gray-200">
      <div className="font-semibold text-yellow-400">{title}</div>
      <div className="mt-1 text-gray-300">{description}</div>
      <div className="mt-4">
        <Link href={href} className="inline-flex rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black">
          Get support
        </Link>
      </div>
    </div>
  );
}
