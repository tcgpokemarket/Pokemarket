import Link from "next/link";

export const metadata = {
  title: "Referrals",
  description: "Invite collectors, earn rewards, and grow the TcgPoké Market community.",
};

const rewards = [
  "Marketplace credit",
  "Free shipping credit",
  "VIP access",
  "Early drop access",
];

export default function ReferralsPage() {
  return (
    <div className="min-h-screen bg-[#08111f] px-4 py-16 text-white sm:px-6 lg:px-8">
      <main className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[#13131f] p-6 sm:p-10">
        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-yellow-400">Referral program</div>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Invite collectors. Earn rewards.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-300">
          Share your referral link with collectors, players, and sellers. When they join and qualify, you earn marketplace rewards that help you keep collecting.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {rewards.map((reward) => (
            <div key={reward} className="rounded-2xl border border-white/10 bg-[#08111f] px-4 py-4 text-sm text-gray-200">
              {reward}
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5">
          <div className="text-sm font-semibold text-yellow-300">Recommended flow</div>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-gray-200">
            <li>Copy your referral link from your account.</li>
            <li>Share it with collectors on social, chat, or email.</li>
            <li>Earn rewards when invited users sign up and buy.</li>
            <li>Repeat with your highest-trust collector network.</li>
          </ol>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/account/email-preferences" className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black transition hover:bg-yellow-300">
            Manage email preferences
          </Link>
          <Link href="/" className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5">
            Back to homepage
          </Link>
        </div>
      </main>
    </div>
  );
}
