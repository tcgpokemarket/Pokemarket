import { describe, expect, it } from "vitest";
import { getListingPrimaryImage, normalizeListingImageRecords, normalizeListingImageUrls } from "./uploads";

describe("listing image normalization", () => {
  it("keeps string and object image values", () => {
    expect(
      normalizeListingImageUrls([
        " https://example.com/one.jpg ",
        { public_url: "https://example.com/two.jpg" },
        { publicUrl: "https://example.com/three.jpg" },
        { url: "https://example.com/four.jpg" },
        null,
        "",
        { public_url: "https://example.com/two.jpg" },
      ]),
    ).toEqual([
      "https://example.com/one.jpg",
      "https://example.com/two.jpg",
      "https://example.com/three.jpg",
      "https://example.com/four.jpg",
    ]);
  });

  it("creates display records from normalized images", () => {
    expect(normalizeListingImageRecords([{ public_url: "https://example.com/one.jpg" }])).toEqual([
      {
        bucket: "listing-images",
        storage_path: "https://example.com/one.jpg",
        public_url: "https://example.com/one.jpg",
        sort_order: 0,
        source: "listing",
      },
    ]);
  });

  it("returns the first usable image", () => {
    expect(getListingPrimaryImage([{ publicUrl: "https://example.com/primary.jpg" }, "https://example.com/secondary.jpg"])).toBe("https://example.com/primary.jpg");
  });
});
