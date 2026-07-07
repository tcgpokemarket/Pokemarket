import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
