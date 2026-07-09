-- ======================================-- TCG Poke Market — Supabase Database Schema
-- Run this in Supabase SQL Editor to set up your database.
-- ======================================
-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique,
  full_name text,
  avatar_url text,
  is_seller boolean default false,
  seller_rating numeric(3,2) default 0,
  total_sales integer default 0,
  created_at timestamptz default now()
);

-- Listings
create table public.listings (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  card_name text not null,
  set_name text not null,
  card_number text,
  rarity text,
  condition text not null check (condition in ('Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged')),
  grade_company text check (grade_company in ('PSA', 'BGS', 'CGC')),
  grade_score numeric(4,2),
  price numeric(10,2) not null,
  quantity integer default 1,
  images text[] default '{}',
  description text,
  shipping_profile_id uuid,
  category text not null check (category in ('single', 'sealed', 'graded', 'accessory')),
  status text default 'active' check (status in ('active', 'sold', 'draft', 'removed')),
  views integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Shipping profiles
create table public.shipping_profiles (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  weight numeric(10,2) not null default 0,
  length numeric(10,2) not null default 0,
  width numeric(10,2) not null default 0,
  height numeric(10,2) not null default 0,
  package_type text not null default 'parcel',
  carrier_preference text,
  handling_time integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Orders
create table public.orders (
  id uuid default gen_random_uuid() primary key,
  buyer_id uuid references public.profiles(id) not null,
  seller_id uuid references public.profiles(id) not null,
  listing_id uuid references public.listings(id) not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  total_amount numeric(10,2) not null,
  item_subtotal numeric(10,2) default 0,
  shipping_amount numeric(10,2) default 0,
  sales_tax_amount numeric(10,2) default 0,
  processing_fee_amount numeric(10,2) default 0,
  marketplace_fee_amount numeric(10,2) default 0,
  seller_payout_amount numeric(10,2) default 0,
  platform_revenue_amount numeric(10,2) default 0,
  marketplace_fee_percent numeric(5,2) default 0,
  seller_tier_name text,
  status text default 'pending' check (status in ('pending', 'paid', 'escrow', 'released', 'frozen', 'disputed', 'shipped', 'delivered', 'cancelled', 'refunded', 'completed')),
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  tracking_number text,
  shipping_carrier text,
  buyer_address jsonb,
  payout_status text default 'pending' check (payout_status in ('pending', 'held', 'released', 'paid', 'failed', 'frozen')),
  escrow_status text default 'held' check (escrow_status in ('held', 'released', 'frozen', 'disputed', 'refunded')),
  escrow_held_at timestamptz,
  escrow_release_at timestamptz,
  escrow_released_at timestamptz,
  escrow_frozen_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seller wallets
create table public.seller_wallets (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.profiles(id) on delete cascade not null unique,
  available_balance numeric(10,2) default 0,
  pending_balance numeric(10,2) default 0,
  frozen_balance numeric(10,2) default 0,
  lifetime_earnings numeric(10,2) default 0,
  completed_orders_count integer default 0,
  instant_payout_enabled boolean default false,
  last_payout_at timestamptz,
  next_payout_at timestamptz,
  fraud_flag boolean default false,
  fraud_risk_score numeric(5,2) default 0,
  fraud_risk_reason text,
  manual_review_required boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.shipment_groups (
  id uuid default gen_random_uuid() primary key,
  buyer_id uuid references public.profiles(id) on delete cascade not null,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  shipping_profile_id uuid references public.shipping_profiles(id),
  status text default 'open' check (status in ('open', 'locked', 'label_created', 'shipped', 'delivered', 'closed')),
  total_weight numeric(10,2) default 0,
  total_length numeric(10,2) default 0,
  total_width numeric(10,2) default 0,
  total_height numeric(10,2) default 0,
  package_type text default 'parcel',
  tracking_number text,
  shipping_carrier text,
  label_url text,
  locked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.live_shows (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  auction_state text default 'upcoming',
  viewer_count integer default 0,
  peak_viewers integer default 0,
  total_sales_amount numeric(10,2) default 0,
  total_bidders integer default 0,
  average_bid_value numeric(10,2) default 0,
  engagement_score numeric(10,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.live_show_items (
  id uuid default gen_random_uuid() primary key,
  show_id uuid references public.live_shows(id) on delete cascade not null,
  listing_id uuid references public.listings(id) on delete set null,
  title text not null,
  subtitle text,
  image_url text,
  start_price numeric(10,2) not null default 0,
  buy_now_price numeric(10,2) default 0,
  current_bid numeric(10,2) not null default 0,
  bid_count integer default 0,
  auction_seconds integer default 30,
  seconds_left integer default 0,
  pinned boolean default false,
  sold boolean default false,
  winner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.live_show_messages (
  id uuid default gen_random_uuid() primary key,
  show_id uuid references public.live_shows(id) on delete cascade not null,
  username text not null,
  message text not null,
  role text default 'viewer',
  highlighted boolean default false,
  created_at timestamptz default now()
);

create table public.live_show_bids (
  id uuid default gen_random_uuid() primary key,
  show_id uuid references public.live_shows(id) on delete cascade not null,
  item_id uuid references public.live_show_items(id) on delete cascade not null,
  username text not null,
  amount numeric(10,2) not null,
  created_at timestamptz default now()
);

-- Seller fee settings
create table public.shipments (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade,
  shipment_group_id uuid references public.shipment_groups(id) on delete cascade,
  shippo_shipment_id text,
  label_url text,
  tracking_number text,
  carrier text,
  status text default 'created',
  created_at timestamptz default now()
);

create table public.tracking_events (
  id uuid default gen_random_uuid() primary key,
  shipment_id uuid references public.shipments(id) on delete cascade not null,
  status text not null,
  location text,
  timestamp timestamptz default now()
);

create table public.seller_fee_settings (
  id uuid default gen_random_uuid() primary key,
  free_sales_limit integer not null default 1000,
  standard_marketplace_fee_percent numeric(5,2) not null default 5,
  processing_fee_percent numeric(5,2) not null default 2.9,
  processing_fee_fixed numeric(10,2) not null default 0.30,
  escrow_hold_hours integer not null default 72,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

create table public.seller_fee_tiers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  min_monthly_orders integer not null,
  fee_percent numeric(5,2) not null,
  active boolean default true,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table public.seller_fee_overrides (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.profiles(id) on delete cascade not null unique,
  fee_percent numeric(5,2),
  free_sales_limit integer,
  reason text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Price history cache
create table public.price_history (
  id uuid default gen_random_uuid() primary key,
  card_name text not null,
  set_name text not null,
  card_number text,
  condition text,
  price numeric(10,2) not null,
  source text not null,
  recorded_at timestamptz default now()
);

create table public.card_library_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  list_key text not null check (list_key in ('collection', 'wishlist', 'deck')),
  card_id text not null,
  card_name text not null,
  set_name text not null,
  card_number text,
  rarity text,
  image_url text,
  price numeric(10,2),
  source text not null,
  added_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, list_key, card_id)
);

create index card_library_items_user_list_idx on public.card_library_items(user_id, list_key);
create index card_library_items_card_idx on public.card_library_items(card_name, set_name);

create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  event_type text not null,
  actor_id uuid,
  action text not null,
  resource_type text,
  resource_id text,
  previous_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create table public.escrow_ledger (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  entry_type text not null check (entry_type in ('hold', 'release', 'freeze', 'refund', 'dispute', 'adjustment')),
  amount numeric(10,2) not null,
  status text not null default 'posted' check (status in ('posted', 'reversed', 'pending')),
  reference_id text,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create unique index escrow_ledger_unique_entry_idx on public.escrow_ledger(order_id, entry_type, coalesce(reference_id, ''));

create table public.escrow_disputes (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null unique,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  buyer_id uuid references public.profiles(id) on delete cascade not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'under_review', 'won', 'lost', 'cancelled')),
  opened_at timestamptz default now(),
  resolved_at timestamptz,
  resolution_note text,
  created_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

create table public.escrow_release_jobs (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null unique,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  release_after_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'released', 'skipped', 'failed')),
  attempted_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index escrow_ledger_order_idx on public.escrow_ledger(order_id);
create index escrow_ledger_seller_idx on public.escrow_ledger(seller_id);
create index escrow_disputes_status_idx on public.escrow_disputes(status);
create index escrow_release_jobs_status_idx on public.escrow_release_jobs(status);

create table public.security_events (
  id uuid default gen_random_uuid() primary key,
  event_type text not null,
  severity text not null default 'medium',
  actor_id uuid,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamptz default now()
);

create table public.device_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  device_name text,
  device_hash text,
  ip_address text,
  user_agent text,
  last_seen_at timestamptz default now(),
  active boolean default true,
  created_at timestamptz default now()
);

create index audit_logs_event_type_idx on public.audit_logs(event_type);
create index audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index security_events_event_type_idx on public.security_events(event_type);
create index device_sessions_user_id_idx on public.device_sessions(user_id);

-- Indexes for common queries
create index listings_seller_id_idx on public.listings(seller_id);
create index listings_status_idx on public.listings(status);
create index listings_category_idx on public.listings(category);
create index listings_price_idx on public.listings(price);
create index listings_card_name_idx on public.listings using gin(to_tsvector('english', card_name));
create index orders_buyer_id_idx on public.orders(buyer_id);
create index orders_seller_id_idx on public.orders(seller_id);
create index price_history_card_idx on public.price_history(card_name, set_name);

-- ======================================-- Row Level Security (RLS)
-- ======================================
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.price_history enable row level security;
alter table public.card_library_items enable row level security;

-- Card library
create policy "card_library_items_select" on public.card_library_items for select using (auth.uid() = user_id);
create policy "card_library_items_insert" on public.card_library_items for insert with check (auth.uid() = user_id);
create policy "card_library_items_update" on public.card_library_items for update using (auth.uid() = user_id);
create policy "card_library_items_delete" on public.card_library_items for delete using (auth.uid() = user_id);

-- Price history (public read)
create policy "price_history_select" on public.price_history for select using (true);
create policy "price_history_insert" on public.price_history for insert with check (true);


-- Profiles
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id and coalesce(is_seller, false) = false);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);

-- Listings
create policy "listings_select" on public.listings for select using (status = 'active' or seller_id = auth.uid());
create policy "listings_insert" on public.listings for insert with check (auth.uid() = seller_id);
create policy "listings_update" on public.listings for update using (auth.uid() = seller_id);
create policy "listings_delete" on public.listings for delete using (auth.uid() = seller_id);

-- Orders
create policy "orders_select" on public.orders for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "orders_insert" on public.orders for insert with check (auth.uid() = buyer_id);
create policy "orders_update" on public.orders for update using (false);

alter table public.seller_wallets enable row level security;
alter table public.escrow_ledger enable row level security;
alter table public.escrow_disputes enable row level security;
alter table public.escrow_release_jobs enable row level security;

create policy "seller_wallets_select" on public.seller_wallets for select using (auth.uid() = seller_id);
create policy "seller_wallets_update" on public.seller_wallets for update using (false);
create policy "escrow_ledger_select" on public.escrow_ledger for select using (auth.uid() = seller_id or exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "escrow_disputes_select" on public.escrow_disputes for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "escrow_release_jobs_select" on public.escrow_release_jobs for select using (auth.uid() = seller_id);

-- Price history (public read)
create policy "price_history_select" on public.price_history for select using (true);
create policy "price_history_insert" on public.price_history for insert with check (true);

-- =============================================
-- Functions & Triggers
-- =============================================
-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger listings_updated_at before update on public.listings
  for each row execute procedure public.handle_updated_at();

create trigger orders_updated_at before update on public.orders
  for each row execute procedure public.handle_updated_at();

-- Increment seller sales count (called from webhook handler)
create or replace function public.increment_seller_sales(seller_id uuid)
returns void as $$
begin
  update public.profiles set total_sales = total_sales + 1 where id = seller_id;
end;
$$ language plpgsql security definer;

create table public.seller_verifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  legal_name text not null,
  date_of_birth date not null,
  residential_address text not null,
  phone_number text not null,
  status text not null default 'not_started' check (status in ('not_started', 'pending_review', 'approved', 'rejected', 'more_information_required', 'suspended')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewer_id uuid references public.profiles(id),
  rejection_reason text,
  more_information_request text,
  suspension_reason text,
  admin_notes text,
  verified_at timestamptz,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table public.seller_verification_documents (
  id uuid default gen_random_uuid() primary key,
  verification_id uuid references public.seller_verifications(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  document_type text not null check (document_type in ('id_front', 'id_back', 'selfie_with_id', 'proof_of_address')),
  storage_bucket text not null default 'verification-documents',
  storage_path text not null,
  mime_type text,
  file_name text,
  created_at timestamptz default now()
);

create table public.seller_verification_history (
  id uuid default gen_random_uuid() primary key,
  verification_id uuid references public.seller_verifications(id) on delete cascade not null,
  actor_id uuid references public.profiles(id),
  action text not null,
  previous_status text,
  next_status text,
  notes text,
  created_at timestamptz default now()
);

create index seller_verifications_status_idx on public.seller_verifications(status);
create index seller_verification_documents_verification_idx on public.seller_verification_documents(verification_id);
create index seller_verification_history_verification_idx on public.seller_verification_history(verification_id);

alter table public.seller_verifications enable row level security;
alter table public.seller_verification_documents enable row level security;
alter table public.seller_verification_history enable row level security;

create policy "seller_verifications_select_own" on public.seller_verifications for select using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));
create policy "seller_verifications_insert_own" on public.seller_verifications for insert with check (auth.uid() = user_id);
create policy "seller_verifications_update_own" on public.seller_verifications for update using (auth.uid() = user_id);
create policy "seller_verification_documents_select_own" on public.seller_verification_documents for select using (auth.uid() = user_id or exists (select 1 from public.seller_verifications v where v.id = verification_id and v.user_id = auth.uid()));
create policy "seller_verification_documents_insert_own" on public.seller_verification_documents for insert with check (auth.uid() = user_id);
create policy "seller_verification_history_select" on public.seller_verification_history for select using (auth.uid() = actor_id or exists (select 1 from public.seller_verifications v where v.id = verification_id and v.user_id = auth.uid()));

alter table public.profiles add column if not exists verification_status text default 'not_started' check (verification_status in ('not_started', 'pending_review', 'approved', 'rejected', 'more_information_required', 'suspended'));
alter table public.profiles add column if not exists verification_submitted_at timestamptz;
alter table public.profiles add column if not exists verification_reviewed_at timestamptz;
alter table public.profiles add column if not exists verification_reviewed_by uuid references public.profiles(id);
alter table public.profiles add column if not exists verification_rejection_reason text;
alter table public.profiles add column if not exists verification_more_info text;
alter table public.profiles add column if not exists verification_suspension_reason text;
alter table public.profiles add column if not exists verified_at timestamptz;

create or replace function public.sync_seller_verification_profile()
returns trigger as $$
begin
  update public.profiles
  set
    verification_status = new.status,
    verification_submitted_at = coalesce(new.submitted_at, verification_submitted_at),
    verification_reviewed_at = new.reviewed_at,
    verification_reviewed_by = new.reviewer_id,
    verification_rejection_reason = new.rejection_reason,
    verification_more_info = new.more_information_request,
    verification_suspension_reason = new.suspension_reason,
    verified_at = new.verified_at,
    is_seller = case when new.status = 'approved' then true else is_seller end,
    updated_at = now()
  where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger seller_verifications_sync_profile
  after insert or update on public.seller_verifications
  for each row execute procedure public.sync_seller_verification_profile();

-- ======================================-- Storage Bucket for listing images
-- Run in Supabase Storage settings or SQL:
-- ======================================-- insert into storage.buckets (id, name, public) values ('listing-images', 'listing-images', true);
-- create policy "listing_images_select" on storage.objects for select using (bucket_id = 'listing-images');
-- create policy "listing_images_insert" on storage.objects for insert with check (bucket_id = 'listing-images' and auth.role() = 'authenticated');
-- create policy "listing_images_delete" on storage.objects for delete using (bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[2]);
-- insert into storage.buckets (id, name, public) values ('verification-documents', 'verification-documents', false);
-- create policy "verification_documents_insert" on storage.objects for insert with check (bucket_id = 'verification-documents' and auth.role() = 'authenticated');
-- create policy "verification_documents_select_own" on storage.objects for select using (bucket_id = 'verification-documents' and auth.uid()::text = (storage.foldername(name))[2]);
-- create policy "verification_documents_delete_own" on storage.objects for delete using (bucket_id = 'verification-documents' and auth.uid()::text = (storage.foldername(name))[2]);
-- create policy "verification_documents_admin_select" on storage.objects for select using (bucket_id = 'verification-documents' and exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));
