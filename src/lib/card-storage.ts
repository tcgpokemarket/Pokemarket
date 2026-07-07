import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

export type SavedCardRecord = {
  id: string;
  name: string;
  setName: string;
  number: string | null;
  rarity: string | null;
  image: string | null;
  price: number | null;
  source: string;
  addedAt: string;
};

type LibraryKey = "collection" | "wishlist" | "deck";

type CardLibraryRow = Database["public"]["Tables"]["card_library_items"]["Row"];
type CardLibraryInsert = Database["public"]["Tables"]["card_library_items"]["Insert"];

function mapRow(row: CardLibraryRow): SavedCardRecord {
  return {
    id: row.card_id,
    name: row.card_name,
    setName: row.set_name,
    number: row.card_number,
    rarity: row.rarity,
    image: row.image_url,
    price: row.price,
    source: row.source,
    addedAt: row.added_at,
  };
}

async function getUserId() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function getSavedCards(key: LibraryKey) {
  const userId = await getUserId();
  if (!userId) return [] as SavedCardRecord[];
  const supabase = createClient();
  const { data } = await supabase
    .from("card_library_items")
    .select("*")
    .eq("user_id", userId)
    .eq("list_key", key)
    .order("added_at", { ascending: false });
  return (data ?? []).map((row) => mapRow(row as CardLibraryRow));
}

export async function saveCard(key: LibraryKey, card: Omit<SavedCardRecord, "addedAt">) {
  const userId = await getUserId();
  if (!userId) return [] as SavedCardRecord[];
  const supabase = createClient();
  const payload: CardLibraryInsert = {
    user_id: userId,
    list_key: key,
    card_id: card.id,
    card_name: card.name,
    set_name: card.setName,
    card_number: card.number,
    rarity: card.rarity,
    image_url: card.image,
    price: card.price,
    source: card.source,
  };
  await supabase.from("card_library_items").upsert([payload] as any, { onConflict: "user_id,list_key,card_id" });
  return getSavedCards(key);
}

export async function removeSavedCard(key: LibraryKey, id: string) {
  const userId = await getUserId();
  if (!userId) return [] as SavedCardRecord[];
  const supabase = createClient();
  await supabase.from("card_library_items").delete().eq("user_id", userId).eq("list_key", key).eq("card_id", id);
  return getSavedCards(key);
}
