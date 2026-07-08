import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { target?: string; avatar_url?: string | null; banner_url?: string | null; logo_url?: string | null };
  const target = body.target;
  const admin = createAdminClient();

  if (target === "profile") {
    const { error } = await (admin as any).from("profiles").upsert({ id: user.id, avatar_url: body.avatar_url ?? null }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (target === "seller") {
    const { error } = await (admin as any).from("sellers").upsert({ id: user.id, avatar_url: body.avatar_url ?? null, banner_url: body.banner_url ?? null }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (target === "store") {
    const { error } = await (admin as any).from("seller_stores").upsert({ seller_id: user.id, logo_url: body.logo_url ?? null, banner_url: body.banner_url ?? null }, { onConflict: "seller_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid target" }, { status: 400 });
}
