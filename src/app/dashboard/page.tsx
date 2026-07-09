import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] text-gray-400">Loading dashboard...</div>}>
      <DashboardClient orderSuccess={false} />
    </Suspense>
  );
}
