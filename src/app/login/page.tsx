"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Preserve the full search string and hash fragment when redirecting to /auth
    const qs = searchParams ? searchParams.toString() : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const target = `/auth${qs ? `?${qs}` : ""}${hash}`;

    // Use replace so history isn't cluttered
    router.replace(target);
  }, [router, searchParams]);

  return null;
}
