import type { Listing } from "@/lib/supabase/types";
import { getListingPrimaryImage } from "@/lib/uploads";

export type CartItem = {
  listingId: string;
  quantity: number;
  title: string;
  price: number;
  image?: string | null;
};

export type CartSnapshot = {
  items: CartItem[];
  updatedAt: string;
};

export function getCartItemTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function toCartItem(listing: Pick<Listing, "id" | "card_name" | "price" | "images">, quantity = 1): CartItem {
  return {
    listingId: listing.id,
    quantity,
    title: listing.card_name,
    price: listing.price,
    image: getListingPrimaryImage(listing.images ?? []) ?? null,
  };
}
