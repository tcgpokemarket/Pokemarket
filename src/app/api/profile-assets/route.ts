import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const target = String(body.target ?? "");
  const admin = createAdminClient();

  if (target === "profile") {
    const profileUpdate = { avatar_url: body.avatar_url ?? null } as any;
    const { error } = await (admin.from("profiles") as any).update(profileUpdate).eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (target === "seller") {
    const updates: Record<string, string | null> = {};
    if ("avatar_url" in body) updates.avatar_url = body.avatar_url ?? null;
    if ("banner_url" in body) updates.banner_url = body.banner_url ?? null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No seller asset provided." }, { status: 400 });
    }

    const { error } = await (admin.from("sellers") as any).update(updates as any).eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (target === "store") {
    const updates: Record<string, string | null> = {};
    if ("logo_url" in body) updates.logo_url = body.logo_url ?? null;
    if ("banner_url" in body) updates.banner_url = body.banner_url ?? null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No store asset provided." }, { status: 400 });
    }

    const { error } = await (admin.from("seller_stores") as any).update(updates as any).eq("seller_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid target." }, { status: 400 });
}
