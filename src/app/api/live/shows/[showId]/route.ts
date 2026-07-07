import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("live_shows").select("*").eq("id", showId).single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ show: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as Record<string, unknown>;
  const { data: existing } = await supabase.from("live_shows").select("seller_id").eq("id", showId).single();
  const existingRow = existing as any;
  if (!existingRow || existingRow.seller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await (supabase as any).from("live_shows").update({
    ...body,
    updated_at: new Date().toISOString(),
  }).eq("id", showId).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ show: data });
}
