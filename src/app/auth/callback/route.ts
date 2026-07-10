import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bootstrapUserAccount } from "@/lib/auth-bootstrap";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = url.searchParams.get("redirectTo") ?? "/dashboard";
  const callbackUrl = new URL(redirectTo, url.origin);

  if (!code) {
    callbackUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(callbackUrl);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session?.user) {
    callbackUrl.searchParams.set("error", "auth_failed");
    return NextResponse.redirect(callbackUrl);
  }

  const user = data.session.user;
  await bootstrapUserAccount({
    userId: user.id,
    email: user.email,
    fullName: (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined) ?? null,
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? (user.user_metadata?.picture as string | undefined) ?? null,
  });

  return NextResponse.redirect(callbackUrl);
}
