-- ============================================================
-- 0013_promotions_system.sql
-- Promotion tables, settings, ledgers, and RLS policies.
-- Idempotent so it can run safely on existing databases.
-- ============================================================

alter table public.seller_stores
  add column if not exists promoted_until timestamptz,
  add column if not exists promotion_tier text,
  add column if not exists promotion_badge text,
  add column if not exists promotion_activated_at timestamptz;

create table if not exists public.seller_promotion_settings (
  seller_id uuid references public.profiles(id) on delete cascade primary key,
  allow_featured_listings boolean not null default true,
  allow_auction_promotion boolean not null default true,
  allow_store_spotlight boolean not null default true,
  allow_event_promotion boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('listing', 'auction', 'store', 'event')),
  target_id text not null,
  tier text not null check (tier in ('boost_24h', 'boost_7d', 'spotlight_24h', 'spotlight_3d', 'spotlight_7d', 'store_7d', 'store_30d', 'event_basic', 'event_featured', 'event_premium')),
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'scheduled', 'expired', 'cancelled', 'refunded')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price numeric(10,2) not null default 0,
  sale_price_percent numeric(5,2),
  minimum_fee numeric(10,2),
  maximum_fee numeric(10,2),
  visibility_rank integer not null default 0,
  badge_label text,
  placement_label text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  wallet_entry_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promotion_events (
  id uuid default gen_random_uuid() primary key,
  promotion_id uuid references public.promotions(id) on delete cascade not null,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  event_type text not null check (event_type in ('created', 'activated', 'expired', 'cancelled', 'refunded', 'updated')),
  note text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.promotion_ledger (
  id uuid default gen_random_uuid() primary key,
  promotion_id uuid references public.promotions(id) on delete cascade not null,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  entry_type text not null check (entry_type in ('hold', 'charge', 'release', 'refund', 'adjustment')),
  amount numeric(10,2) not null,
  status text not null default 'posted' check (status in ('posted', 'reversed', 'pending')),
  reference_id text,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists promotion_ledger_unique_entry_idx on public.promotion_ledger(promotion_id, entry_type, coalesce(reference_id, ''));
create index if not exists promotions_seller_idx on public.promotions(seller_id);
create index if not exists promotions_target_idx on public.promotions(target_type, target_id);
create index if not exists promotions_status_idx on public.promotions(status);
create index if not exists promotion_events_promotion_idx on public.promotion_events(promotion_id);
create index if not exists promotion_ledger_promotion_idx on public.promotion_ledger(promotion_id);

alter table public.seller_promotion_settings enable row level security;
alter table public.promotions enable row level security;
alter table public.promotion_events enable row level security;
alter table public.promotion_ledger enable row level security;

create policy "seller_promotion_settings_select" on public.seller_promotion_settings
  for select using (auth.uid() = seller_id or auth.uid() is not null);
create policy "seller_promotion_settings_insert" on public.seller_promotion_settings
  for insert with check (auth.uid() = seller_id);
create policy "seller_promotion_settings_update" on public.seller_promotion_settings
  for update using (auth.uid() = seller_id);

create policy "promotions_select" on public.promotions
  for select using (
    auth.uid() = seller_id
    or exists (
      select 1 from public.listings l
      where l.id::text = target_id and l.seller_id = auth.uid()
    )
  );
create policy "promotions_insert" on public.promotions
  for insert with check (auth.uid() = seller_id);
create policy "promotions_update" on public.promotions
  for update using (auth.uid() = seller_id);

create policy "promotion_events_select" on public.promotion_events
  for select using (auth.uid() = seller_id or exists (select 1 from public.promotions p where p.id = promotion_id and p.seller_id = auth.uid()));
create policy "promotion_ledger_select" on public.promotion_ledger
  for select using (auth.uid() = seller_id or exists (select 1 from public.promotions p where p.id = promotion_id and p.seller_id = auth.uid()));

insert into public.seller_promotion_settings (seller_id)
select id from public.profiles
where not exists (
  select 1 from public.seller_promotion_settings s where s.seller_id = public.profiles.id
);

update public.seller_stores
set
  promoted_until = promoted_until,
  promotion_tier = promotion_tier,
  promotion_badge = promotion_badge,
  promotion_activated_at = promotion_activated_at
where promoted_until is not null or promotion_tier is not null or promotion_badge is not null or promotion_activated_at is not null;
