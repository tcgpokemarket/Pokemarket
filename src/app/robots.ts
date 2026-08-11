import type { MetadataRoute } from "next";

const BASE_URL = "https://tcg-poke-market.sintra.site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/auth",
          "/dashboard",
          "/wallet",
          "/checkout",
          "/messages",
          "/admin",
          "/seller",
          "/settings",
          "/api/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
