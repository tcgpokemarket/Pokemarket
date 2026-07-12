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

  const bootstrap = await bootstrapUserAccount({
    userId: user.id,
    email: user.email,
    fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  });

  const body = await request.json();
  const { data: seller, error: sellerError } = await supabase
    .from("sellers")
    .select("id")
    .eq("id", bootstrap.sellerId)
    .maybeSingle<{ id: string }>();

  if (sellerError) {
    return NextResponse.json({ error: sellerError.message ?? "Failed to resolve seller account." }, { status: 400 });
  }

  if (!seller?.id) {
    return NextResponse.json({ error: "Seller account is not ready yet. Please refresh and try again." }, { status: 400 });
  }

  const payload = {
    seller_id: seller.id,
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

  const { data, error } = await (supabase.from("listings") as any).insert(payload).select("id").single<{ id: string }>();

  if (error) {
    return NextResponse.json({ error: error.message ?? "Failed to create listing." }, { status: 400 });
  }

  return NextResponse.json({ listing: data }, { status: 201 });
}
