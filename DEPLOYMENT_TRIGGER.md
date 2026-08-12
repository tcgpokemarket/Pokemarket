# Deployment Trigger

Fresh production deployment trigger after the ListingCard TypeScript fix.

- Main commit includes the seller-relation narrowing in `src/components/listings/ListingCard.tsx`.
- Supabase production migration history was audited without rewriting remote history.
- This file is intentionally non-functional and exists only to trigger the connected Vercel production deployment from `main`.
