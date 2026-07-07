import { createClient } from "@/lib/supabase/server";
import type { PriceHistory } from "@/lib/supabase/types";
import { fetchCardPrice } from "@/lib/prices";

export async function fetchAndRecordCardPrice(cardName: string, setName: string) {
  const price = await fetchCardPrice(cardName, setName);
  const supabase = await createClient();

  if (price.marketPrice !== null) {
    const entry: PriceHistory = {
      id: crypto.randomUUID(),
      card_name: price.cardName,
      set_name: price.setName,
      card_number: null,
      condition: null,
      price: price.marketPrice,
      source: price.source,
      recorded_at: new Date().toISOString(),
    };

    await supabase.from("price_history").insert(entry as any);
  }

  return price;
}
