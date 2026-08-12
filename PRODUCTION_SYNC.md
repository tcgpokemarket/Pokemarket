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

This file is intentionally non-functional and exists to create a fresh Git revision after the feature fixes so the connected deployment pipeline can consume the complete `main` tree as one production baseline.
