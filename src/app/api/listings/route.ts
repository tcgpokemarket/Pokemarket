import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { bootstrapUserAccount } from "@/lib/auth-bootstrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await bootstrapUserAccount({
      userId: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
    });
  } catch (error) {
    console.warn("[listings.publish] seller bootstrap failed", {
      authUserId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const body = await request.json().catch(() => ({}));
  const payload = {
    seller_id: user.id,
    card_name: String(body.card_name ?? "").trim(),
    set_name: String(body.set_name ?? "").trim(),
    card_number: body.card_number ? String(body.card_number).trim() : null,
    rarity: body.rarity ? String(body.rarity).trim() : null,
    condition: String(body.condition ?? "Near Mint"),
    category: String(body.category ?? "single"),
    price: Number(body.price ?? 0),
    quantity: Number.isFinite(Number(body.quantity)) ? Math.max(1, Number(body.quantity)) : 1,
    description: body.description ? String(body.description).trim() : null,
    grade_company: body.grade_company ? String(body.grade_company).trim() : null,
    grade_score: body.grade_score === null || body.grade_score === undefined || body.grade_score === "" ? null : Number(body.grade_score),
    images: Array.isArray(body.images) ? (body.images as unknown[]).filter((value): value is string => typeof value === "string") : [],
    status: String(body.status ?? "active"),
  };

  console.info("[listings.publish]", {
    authUserId: user.id,
    sellerId: user.id,
    imageCount: payload.images.length,
    images: payload.images,
    listingPayload: {
      ...payload,
      images: `[${payload.images.length} images]`,
    },
  });

  const { data: profile, error: profileError } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle<{ id: string }>();

  if (profileError) {
    console.error("[listings.publish] profile lookup failed", { authUserId: user.id, error: profileError.message });
    return NextResponse.json({ error: profileError.message ?? "Failed to resolve seller profile." }, { status: 400 });
  }

  if (!profile?.id) {
    console.error("[listings.publish] missing profile", { authUserId: user.id });
    return NextResponse.json({ error: "We couldn’t find your seller profile yet. Please refresh and try again." }, { status: 400 });
  }

  const { data, error } = await (supabase.from("listings") as any).insert(payload).select("id").single();
  const listing = data as { id: string } | null;

  if (error) {
    console.error("[listings.publish] insert failed", {
      authUserId: user.id,
      sellerId: payload.seller_id,
        images: payload.images,
      error: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return NextResponse.json({ error: "We couldn’t publish this listing right now. Please try again." }, { status: 400 });
  }

  return NextResponse.json({ listing }, { status: 201 });
}
