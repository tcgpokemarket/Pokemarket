import { describe, expect, it } from "vitest";
import { assertRequiredEnvironment, formatEnvironmentAudit, getCriticalEnvironmentAudit } from "../lib/env";

describe("environment audit", () => {
  it("passes when the critical environment is present", () => {
    expect(() =>
      assertRequiredEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        STRIPE_SECRET_KEY: "sk_test_123",
        STRIPE_WEBHOOK_SECRET: "whsec_123",
        NEXT_PUBLIC_SITE_URL: "https://example.com",
      }),
    ).not.toThrow();
  });

  it("reports missing critical environment variables", () => {
    expect(() =>
      assertRequiredEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SITE_URL: "https://example.com",
      }),
    ).toThrow(/Missing required environment variables/);
  });

  it("summarizes configured and missing services", () => {
    const audit = formatEnvironmentAudit({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      STRIPE_SECRET_KEY: "sk_test_123",
      STRIPE_WEBHOOK_SECRET: "whsec_123",
      NEXT_PUBLIC_SITE_URL: "https://example.com",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://example.livekit.cloud",
      LIVEKIT_API_KEY: "livekit-key",
      LIVEKIT_API_SECRET: "livekit-secret",
      CLOUDINARY_CLOUD_NAME: "cloud",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
      OPENAI_API_KEY: "openai-key",
      USPS_LABELS_URL: "https://apis.usps.com/labels/v3/carrier-pickup",
    });

    expect(audit).toContain("Supabase: configured");
    expect(audit).toContain("Stripe: configured");
    expect(audit).toContain("LiveKit: configured");
    expect(audit).toContain("USPS shipping: configured");
  });

  it("captures the critical environment groups", () => {
    expect(getCriticalEnvironmentAudit({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      STRIPE_SECRET_KEY: "sk_test_123",
      STRIPE_WEBHOOK_SECRET: "whsec_123",
      NEXT_PUBLIC_SITE_URL: "https://example.com",
    })).toEqual([
      { name: "Supabase", missing: [] },
      { name: "Stripe", missing: [] },
      { name: "Site", missing: [] },
    ]);
  });
});
