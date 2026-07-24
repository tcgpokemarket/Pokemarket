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
    const profileUpdate: Record<string, string | null> = {};
    if ("avatar_url" in body) profileUpdate.avatar_url = body.avatar_url ?? null;
    if ("seller_state" in body) profileUpdate.seller_state = String(body.seller_state ?? "").trim().toUpperCase() || null;
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

    const { error } = await (admin.from("seller_stores") as any).update(updates as any).eq("seller_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (target === "store") {
    const updates: Record<string, unknown> = {};
    if ("name" in body) updates.name = String(body.name ?? "").trim();
    if ("slug" in body) updates.slug = String(body.slug ?? "").trim();
    if ("description" in body) updates.description = String(body.description ?? "").trim() || null;
    if ("logo_url" in body) updates.logo_url = body.logo_url ?? null;
    if ("banner_url" in body) updates.banner_url = body.banner_url ?? null;
    if ("theme" in body && body.theme && typeof body.theme === "object") {
      const theme = body.theme as Record<string, unknown>;
      const socialLinks = theme.social_links && typeof theme.social_links === "object" ? theme.social_links as Record<string, unknown> : {};
      updates.theme = {
        accent: typeof theme.accent === "string" ? theme.accent : null,
        secondary: typeof theme.secondary === "string" ? theme.secondary : null,
        highlight: typeof theme.highlight === "string" ? theme.highlight : null,
        social_links: {
          instagram: typeof socialLinks.instagram === "string" ? socialLinks.instagram : null,
          facebook: typeof socialLinks.facebook === "string" ? socialLinks.facebook : null,
          youtube: typeof socialLinks.youtube === "string" ? socialLinks.youtube : null,
          tiktok: typeof socialLinks.tiktok === "string" ? socialLinks.tiktok : null,
          x: typeof socialLinks.x === "string" ? socialLinks.x : null,
          website: typeof socialLinks.website === "string" ? socialLinks.website : null,
        },
      };
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No store settings provided." }, { status: 400 });
    }

    const { error } = await (admin.from("seller_stores") as any).update(updates as any).eq("seller_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid target." }, { status: 400 });
}
