import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSellerVerificationApproved, type SellerVerificationStatus } from "@/lib/seller-verification";
import { recordAuditEvent } from "@/lib/audit-log";

const PAGE_SIZE = 24;

async function getVerificationStatus(userId: string): Promise<SellerVerificationStatus> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("seller_verifications").select("status").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return ((data as { status?: SellerVerificationStatus } | null)?.status ?? "not_started") as SellerVerificationStatus;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") ?? "").trim();
  const category = (searchParams.get("category") ?? "").trim();
  const condition = (searchParams.get("condition") ?? "").trim();
  const seller = (searchParams.get("seller") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let request = supabase
    .from("listings")
    .select("*, profiles:seller_id(username, seller_rating), sellers:seller_id(display_name, storefront_slug, rating, verified, avatar_url)", { count: "exact" })
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (query) {
    request = request.or(
      `card_name.ilike.%${query}%,set_name.ilike.%${query}%,card_number.ilike.%${query}%,rarity.ilike.%${query}%,description.ilike.%${query}%`
    );
  }
  if (category && category !== "all") request = request.eq("category", category);
  if (condition && condition !== "all") request = request.eq("condition", condition);
  if (seller) request = request.eq("seller_id", seller);

  const { data, count, error } = await request.range(from, to);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ listings: data ?? [], count: count ?? 0, page, pageSize: PAGE_SIZE });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const verificationStatus = await getVerificationStatus(user.id);
  if (!isSellerVerificationApproved(verificationStatus)) {
    recordAuditEvent({
      event_type: "api.denied",
      actor_id: user.id,
      action: "create_listing_blocked_verification",
      resource_type: "listing",
      resource_id: user.id,
      previous_value: { verificationStatus },
      new_value: null,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ error: "Identity verification is required before creating listings." }, { status: 403 });
  }

  const body = (await req.json()) as {
    card_name?: string;
    set_name?: string;
    card_number?: string | null;
    rarity?: string | null;
    condition?: string;
    category?: string;
    price?: number;
    quantity?: number;
    description?: string | null;
    grade_company?: string | null;
    grade_score?: number | null;
    images?: string[];
    status?: string;
    shipping_paid_by?: "buyer" | "seller";
  };

  if (!body.card_name || !body.set_name || !body.condition || !body.category || typeof body.price !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const listingPayload = {
    seller_id: user.id,
    card_name: body.card_name,
    set_name: body.set_name,
    card_number: body.card_number ?? null,
    rarity: body.rarity ?? null,
    condition: body.condition as any,
    category: body.category as any,
    price: body.price,
    quantity: body.quantity ?? 1,
    description: body.description ?? null,
    grade_company: body.grade_company ?? null,
    grade_score: body.grade_score ?? null,
    images: body.images ?? [],
    status: body.status ?? "active",
    shipping_paid_by: body.shipping_paid_by ?? "buyer",
  };

  const { data, error } = await supabase.from("listings").insert(listingPayload as any).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ listing: data });
}
