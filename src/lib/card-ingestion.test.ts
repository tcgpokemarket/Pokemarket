import { describe, expect, it } from "vitest";
import { buildListingDraftFromIngestionItem, getPublishabilityIssues } from "./card-ingestion";

describe("card ingestion publish helpers", () => {
  it("flags missing publish fields", () => {
    expect(getPublishabilityIssues({
      card_name: "",
      set_name: null,
      likely_condition: null,
      category: "",
      estimated_price: null,
      low_price: null,
      high_price: null,
    })).toEqual([
      "card name is missing",
      "set name is missing",
      "condition is missing",
      "category is missing",
      "pricing is missing",
    ]);
  });

  it("builds an active listing draft from an ingestion item", () => {
    expect(buildListingDraftFromIngestionItem({
      created_by: "seller-1",
      card_name: "Pikachu",
      set_name: "Base Set",
      card_number: "58",
      rarity: "Common",
      likely_condition: "Near Mint",
      category: "single",
      estimated_price: 12.5,
      low_price: 10,
      high_price: 15,
      review_notes: "Good centering.",
      description: "Classic card.",
      title: "Pikachu — Base Set",
      source_image_url: "https://example.com/card.jpg",
    })).toEqual({
      seller_id: "seller-1",
      card_name: "Pikachu",
      set_name: "Base Set",
      card_number: "58",
      rarity: "Common",
      condition: "Near Mint",
      category: "single",
      price: 12.5,
      quantity: 1,
      description: "Classic card.\n\nGood centering.",
      images: ["https://example.com/card.jpg"],
      status: "active",
    });
  });
});
