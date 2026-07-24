import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function safeRedirect(value: string | undefined) {
  if (!value || !value.startsWith("/")) return "/dashboard";
  if (value.startsWith("/auth") || value === "/login" || value === "/signup") return "/dashboard";
  return value;
}

export default function SignInPage({ searchParams }: { searchParams?: SearchParams }) {
  const redirectTo = safeRedirect(typeof searchParams?.redirectTo === "string" ? searchParams.redirectTo : undefined);
  redirect(`/auth?mode=signin&redirectTo=${encodeURIComponent(redirectTo)}`);
}
