export const dynamic = "force-dynamic";

import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

export default function DashboardPage({ searchParams }: { searchParams?: { success?: string } }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] text-gray-400">Loading dashboard...</div>}>
      <DashboardClient orderSuccess={searchParams?.success === "1"} />
    </Suspense>
  );
}
