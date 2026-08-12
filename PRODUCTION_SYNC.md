# Production Fix Baseline

This marker commit intentionally consolidates the current `main` state for the next Vercel production deployment.

Production requirements represented by the current branch include:
- persistent authenticated sessions until explicit sign-out/session expiry
- seller verification reflected consistently on listings
- customer geolocation used only as an input to server-side tax calculation
- referral rewards constrained by server-side profitability rules
- separate seller accounts and site-controlled Rips
- wallet top-ups credited only after verified Stripe payment/webhook processing
- marketplace homepage with active listings and live/upcoming shows
- listing images and verified-seller badges
- tier/Poké Ball presentation
- canonical SEO configuration for `tcgpoke.app`

## Supabase migration audit — 2026-08-11

The production Supabase project was inspected directly. Its migration history currently contains 21 remote entries, including the Rips, wallet, seller/social, and referral lifecycle changes applied during the latest production work.

The repository's `supabase/migrations` directory does not contain a one-to-one timestamp match for that remote history: it still contains the older `0001`–`0021` migration series plus the Rips-era timestamped files through `20260811032000`, while production also has later remote entries such as `20260811032355`, `20260811101649`, `20260811172141`, `20260811180135`, and `20260811180724`.

This is intentionally documented here rather than rewriting `supabase_migrations.schema_migrations` by hand. Supabase's supported reconciliation flow is to pull the linked remote schema into a migration, verify it locally, and use `supabase migration repair` only for history records whose schema changes are already known to exist. That avoids falsely marking SQL as applied or hiding schema drift.

Before the next database migration push, run the linked-project reconciliation workflow (`supabase db pull --linked`, local reset/verification, then the exact `supabase migration repair` operations reported by `supabase migration list`).

This file is intentionally non-functional and exists to create a fresh Git revision after the feature fixes so the connected deployment pipeline can consume the complete `main` tree as one production baseline.

Deployment trigger refresh: 2026-08-11 — force a fresh Git revision so the connected Vercel production integration evaluates the complete `main` tree after the ListingCard type fix.
