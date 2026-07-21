-- ============================================================
-- 0010_missing_tables_and_columns.sql
-- Comprehensive idempotent migration: adds all tables,
-- columns, functions, triggers, RLS policies, and indexes
-- that exist in schema.sql / types.ts but had no numbered
-- migration. Fully idempotent — safe to re-run on any db.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- profiles: add missing columns
-- ──────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists seller_state text,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists verification_status text default 'not_started'
    check (verification_status in (
      'not_started','pending_review','approved','rejected',
      'more_information_required','suspended'
    )),
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists verification_reviewed_at timestamptz,
  add column if not exists verification_reviewed_by uuid references public.profiles(id),
  add column if not exists verification_rejection_reason text,
  add column if not exists verification_more_info text,
  add column if not exists verification_suspension_reason text,
  add column if not exists verified_at timestamptz;

-- Fix overly-restrictive profiles_update policy (was blocking sellers)
do $$ begin
  drop policy if exists "profiles_update" on public.profiles;
  create policy "profiles_update" on public.profiles
    for update using (auth.uid() = id);
exception when others then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- listings: add missing columns
-- ──────────────────────────────────────────────────────────────
alter table public.listings
  add column if not exists shipping_paid_by text
    check (shipping_paid_by in ('buyer', 'seller')),
  add column if not exists weight_oz numeric(10,2),
  add column if not exists package_type text;

-- ──────────────────────────────────────────────────────────────
-- orders: add missing referral & financial tracking columns
-- ──────────────────────────────────────────────────────────────
alter table public.orders
  add column if not exists buyer_referral_source text,
  add column if not exists seller_referral_source text,
  add column if not exists creator_referral_source text,
  add column if not exists referral_commission_amount numeric(10,2),
  add column if not exists referral_commission_status text,
  add column if not exists referral_source_code text,
  add column if not exists referral_source_user_id uuid,
  add column if not exists referral_attribution_id uuid,
  add column if not exists first_transaction_at timestamptz,
  add column if not exists total_revenue_generated numeric(10,2),
  add column if not exists total_rewards_earned numeric(10,2);

-- ──────────────────────────────────────────────────────────────
-- referral_attributions: add columns present in schema.sql
-- but absent from migration 0008
-- ──────────────────────────────────────────────────────────────
alter table public.referral_attributions
  add column if not exists referral_code text not null default '',
  add column if not exists signup_source text not null default '',
  add column if not exists total_revenue_generated numeric(10,2) not null default 0,
  add column if not exists total_rewards_earned numeric(10,2) not null default 0;

-- ──────────────────────────────────────────────────────────────
-- shipping_profiles
-- ──────────────────────────────────────────────────────────────
create table if not exists public.shipping_profiles (
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

alter table public.shipping_profiles enable row level security;

do $$ begin
  create policy "shipping_profiles_select_own" on public.shipping_profiles
    for select using (auth.uid() = seller_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "shipping_profiles_insert_own" on public.shipping_profiles
    for insert with check (auth.uid() = seller_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "shipping_profiles_update_own" on public.shipping_profiles
    for update using (auth.uid() = seller_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "shipping_profiles_delete_own" on public.shipping_profiles
    for delete using (auth.uid() = seller_id);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- seller_wallets (ensure table + RLS)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.seller_wallets (
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

alter table public.seller_wallets enable row level security;

create index if not exists seller_wallets_seller_id_idx on public.seller_wallets(seller_id);

do $$ begin
  create policy "seller_wallets_select" on public.seller_wallets
    for select using (auth.uid() = seller_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "seller_wallets_update" on public.seller_wallets
    for update using (false);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- shipment_groups
-- ──────────────────────────────────────────────────────────────
create table if not exists public.shipment_groups (
  id uuid default gen_random_uuid() primary key,
  buyer_id uuid references public.profiles(id) on delete cascade not null,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  shipping_profile_id uuid references public.shipping_profiles(id),
  status text default 'open'
    check (status in ('open','locked','label_created','shipped','delivered','closed')),
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

alter table public.shipment_groups enable row level security;

do $$ begin
  create policy "shipment_groups_select" on public.shipment_groups
    for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "shipment_groups_insert" on public.shipment_groups
    for insert with check (auth.uid() = buyer_id or auth.uid() = seller_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "shipment_groups_update" on public.shipment_groups
    for update using (auth.uid() = seller_id);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- shipments
-- ──────────────────────────────────────────────────────────────
create table if not exists public.shipments (
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

alter table public.shipments enable row level security;

do $$ begin
  create policy "shipments_select" on public.shipments
    for select using (
      exists (
        select 1 from public.orders o
        where o.id = order_id
          and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
      )
    );
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- tracking_events
-- ──────────────────────────────────────────────────────────────
create table if not exists public.tracking_events (
  id uuid default gen_random_uuid() primary key,
  shipment_id uuid references public.shipments(id) on delete cascade not null,
  status text not null,
  location text,
  timestamp timestamptz default now()
);

alter table public.tracking_events enable row level security;

do $$ begin
  create policy "tracking_events_select" on public.tracking_events
    for select using (
      exists (
        select 1 from public.shipments s
          join public.orders o on o.id = s.order_id
        where s.id = shipment_id
          and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
      )
    );
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- seller_fee_settings (ensure table + RLS + seed row)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.seller_fee_settings (
  id uuid default gen_random_uuid() primary key,
  free_sales_limit integer not null default 1000,
  standard_marketplace_fee_percent numeric(5,2) not null default 5,
  processing_fee_percent numeric(5,2) not null default 2.9,
  processing_fee_fixed numeric(10,2) not null default 0.30,
  escrow_hold_hours integer not null default 72,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

alter table public.seller_fee_settings enable row level security;

do $$ begin
  create policy "seller_fee_settings_select" on public.seller_fee_settings
    for select using (auth.uid() is not null);
exception when duplicate_object then null; end $$;

insert into public.seller_fee_settings (id)
select gen_random_uuid()
where not exists (select 1 from public.seller_fee_settings);

-- ──────────────────────────────────────────────────────────────
-- seller_fee_tiers
-- ──────────────────────────────────────────────────────────────
create table if not exists public.seller_fee_tiers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  min_monthly_orders integer not null,
  fee_percent numeric(5,2) not null,
  active boolean default true,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.seller_fee_tiers enable row level security;

do $$ begin
  create policy "seller_fee_tiers_select" on public.seller_fee_tiers
    for select using (auth.uid() is not null);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- seller_fee_overrides
-- ──────────────────────────────────────────────────────────────
create table if not exists public.seller_fee_overrides (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.profiles(id) on delete cascade not null unique,
  fee_percent numeric(5,2),
  free_sales_limit integer,
  reason text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.seller_fee_overrides enable row level security;

do $$ begin
  create policy "seller_fee_overrides_select_own" on public.seller_fee_overrides
    for select using (auth.uid() = seller_id);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- price_history (fix duplicate policy from schema.sql)
-- ──────────────────────────────────────────────────────────────
alter table public.price_history enable row level security;

do $$ begin
  drop policy if exists "price_history_select" on public.price_history;
  drop policy if exists "price_history_insert" on public.price_history;
  create policy "price_history_select" on public.price_history for select using (true);
  create policy "price_history_insert" on public.price_history for insert with check (true);
exception when others then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- card_library_items (ensure table + indexes exist)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.card_library_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  list_key text not null check (list_key in ('collection','wishlist','deck')),
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

alter table public.card_library_items enable row level security;

create index if not exists card_library_items_user_list_idx
  on public.card_library_items(user_id, list_key);
create index if not exists card_library_items_card_idx
  on public.card_library_items(card_name, set_name);

-- ──────────────────────────────────────────────────────────────
-- audit_logs
-- ──────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
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

alter table public.audit_logs enable row level security;

create index if not exists audit_logs_event_type_idx on public.audit_logs(event_type);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

do $$ begin
  create policy "audit_logs_insert" on public.audit_logs
    for insert with check (true);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- escrow_ledger
-- ──────────────────────────────────────────────────────────────
create table if not exists public.escrow_ledger (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  entry_type text not null
    check (entry_type in ('hold','release','freeze','refund','dispute','adjustment')),
  amount numeric(10,2) not null,
  status text not null default 'posted'
    check (status in ('posted','reversed','pending')),
  reference_id text,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create unique index if not exists escrow_ledger_unique_entry_idx
  on public.escrow_ledger(order_id, entry_type, coalesce(reference_id, ''));

create index if not exists escrow_ledger_order_idx on public.escrow_ledger(order_id);
create index if not exists escrow_ledger_seller_idx on public.escrow_ledger(seller_id);

alter table public.escrow_ledger enable row level security;

do $$ begin
  create policy "escrow_ledger_select" on public.escrow_ledger
    for select using (
      auth.uid() = seller_id or
      exists (
        select 1 from public.orders o
        where o.id = order_id
          and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
      )
    );
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- escrow_disputes
-- ──────────────────────────────────────────────────────────────
create table if not exists public.escrow_disputes (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null unique,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  buyer_id uuid references public.profiles(id) on delete cascade not null,
  reason text not null,
  status text not null default 'open'
    check (status in ('open','under_review','won','lost','cancelled')),
  opened_at timestamptz default now(),
  resolved_at timestamptz,
  resolution_note text,
  created_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

create index if not exists escrow_disputes_status_idx on public.escrow_disputes(status);

alter table public.escrow_disputes enable row level security;

do $$ begin
  create policy "escrow_disputes_select" on public.escrow_disputes
    for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- escrow_release_jobs
-- ──────────────────────────────────────────────────────────────
create table if not exists public.escrow_release_jobs (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null unique,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  release_after_at timestamptz not null,
  status text not null default 'queued'
    check (status in ('queued','running','released','skipped','failed')),
  attempted_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists escrow_release_jobs_status_idx on public.escrow_release_jobs(status);

alter table public.escrow_release_jobs enable row level security;

do $$ begin
  create policy "escrow_release_jobs_select" on public.escrow_release_jobs
    for select using (auth.uid() = seller_id);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- security_events
-- ──────────────────────────────────────────────────────────────
create table if not exists public.security_events (
  id uuid default gen_random_uuid() primary key,
  event_type text not null,
  severity text not null default 'medium',
  actor_id uuid,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamptz default now()
);

alter table public.security_events enable row level security;

create index if not exists security_events_event_type_idx on public.security_events(event_type);
create index if not exists security_events_actor_id_idx on public.security_events(actor_id);
create index if not exists security_events_created_at_idx on public.security_events(created_at desc);

do $$ begin
  create policy "security_events_insert" on public.security_events
    for insert with check (true);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- device_sessions
-- ──────────────────────────────────────────────────────────────
create table if not exists public.device_sessions (
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

alter table public.device_sessions enable row level security;

create index if not exists device_sessions_user_id_idx on public.device_sessions(user_id);

do $$ begin
  create policy "device_sessions_select_own" on public.device_sessions
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "device_sessions_insert_own" on public.device_sessions
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "device_sessions_update_own" on public.device_sessions
    for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- seller_verifications
-- ──────────────────────────────────────────────────────────────
create table if not exists public.seller_verifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  legal_name text not null,
  date_of_birth date not null,
  residential_address text not null,
  phone_number text not null,
  status text not null default 'not_started'
    check (status in (
      'not_started','pending_review','approved','rejected',
      'more_information_required','suspended'
    )),
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

create index if not exists seller_verifications_status_idx
  on public.seller_verifications(status);

alter table public.seller_verifications enable row level security;

do $$ begin
  create policy "seller_verifications_select_own" on public.seller_verifications
    for select using (
      auth.uid() = user_id or
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and coalesce(p.is_seller, false) = true
      )
    );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "seller_verifications_insert_own" on public.seller_verifications
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "seller_verifications_update_own" on public.seller_verifications
    for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- seller_verification_documents
-- ──────────────────────────────────────────────────────────────
create table if not exists public.seller_verification_documents (
  id uuid default gen_random_uuid() primary key,
  verification_id uuid references public.seller_verifications(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  document_type text not null
    check (document_type in ('id_front','id_back','selfie_with_id','proof_of_address')),
  storage_bucket text not null default 'verification-documents',
  storage_path text not null,
  mime_type text,
  file_name text,
  created_at timestamptz default now()
);

create index if not exists seller_verification_documents_verification_idx
  on public.seller_verification_documents(verification_id);

alter table public.seller_verification_documents enable row level security;

do $$ begin
  create policy "seller_verification_documents_select_own"
    on public.seller_verification_documents
    for select using (
      auth.uid() = user_id or
      exists (
        select 1 from public.seller_verifications v
        where v.id = verification_id and v.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "seller_verification_documents_insert_own"
    on public.seller_verification_documents
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- seller_verification_history
-- ──────────────────────────────────────────────────────────────
create table if not exists public.seller_verification_history (
  id uuid default gen_random_uuid() primary key,
  verification_id uuid references public.seller_verifications(id) on delete cascade not null,
  actor_id uuid references public.profiles(id),
  action text not null,
  previous_status text,
  next_status text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists seller_verification_history_verification_idx
  on public.seller_verification_history(verification_id);

alter table public.seller_verification_history enable row level security;

do $$ begin
  create policy "seller_verification_history_select"
    on public.seller_verification_history
    for select using (
      auth.uid() = actor_id or
      exists (
        select 1 from public.seller_verifications v
        where v.id = verification_id and v.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- legal_documents (new — in types.ts but had no migration)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.legal_documents (
  id uuid default gen_random_uuid() primary key,
  slug text not null unique,
  title text not null,
  version text not null,
  jurisdiction text,
  content text not null,
  active boolean not null default true,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.legal_documents enable row level security;

do $$ begin
  create policy "legal_documents_select" on public.legal_documents
    for select using (active = true);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- legal_acceptances (new)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.legal_acceptances (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  document_slug text not null,
  document_version text not null,
  accepted_at timestamptz default now(),
  accepted_ip text,
  accepted_user_agent text,
  source text not null,
  unique (user_id, document_slug, document_version)
);

create index if not exists legal_acceptances_user_id_idx
  on public.legal_acceptances(user_id, document_slug);

alter table public.legal_acceptances enable row level security;

do $$ begin
  create policy "legal_acceptances_select_own" on public.legal_acceptances
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "legal_acceptances_insert_own" on public.legal_acceptances
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- ip_reports (new)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.ip_reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references auth.users(id) on delete set null,
  subject_type text not null,
  subject_id text,
  complaint_type text not null,
  details text not null,
  status text not null default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ip_reports enable row level security;

do $$ begin
  create policy "ip_reports_insert" on public.ip_reports
    for insert with check (auth.uid() is not null);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "ip_reports_select_own" on public.ip_reports
    for select using (auth.uid() = reporter_id);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- dispute_records (new)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.dispute_records (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  dispute_type text not null,
  status text not null default 'open',
  resolution text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.dispute_records enable row level security;

do $$ begin
  create policy "dispute_records_select" on public.dispute_records
    for select using (
      auth.uid() = user_id or
      exists (
        select 1 from public.orders o
        where o.id = order_id
          and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
      )
    );
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- webhook_events: enable RLS (table exists from 0005)
-- ──────────────────────────────────────────────────────────────
alter table public.webhook_events enable row level security;

do $$ begin
  create policy "webhook_events_insert" on public.webhook_events
    for insert with check (true);
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- sellers / seller_stores / seller_followers / seller_reviews:
-- ensure RLS (tables exist from 0001)
-- ──────────────────────────────────────────────────────────────
alter table public.sellers enable row level security;
alter table public.seller_followers enable row level security;
alter table public.seller_reviews enable row level security;
alter table public.seller_stores enable row level security;

do $$ begin
  create policy "sellers_select" on public.sellers for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "sellers_insert_own" on public.sellers
    for insert with check (auth.uid() = id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "sellers_update_own" on public.sellers
    for update using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "seller_followers_select" on public.seller_followers
    for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "seller_followers_insert" on public.seller_followers
    for insert with check (auth.uid() = follower_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "seller_followers_delete" on public.seller_followers
    for delete using (auth.uid() = follower_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "seller_reviews_select" on public.seller_reviews
    for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "seller_reviews_insert" on public.seller_reviews
    for insert with check (auth.uid() = buyer_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "seller_stores_select" on public.seller_stores
    for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "seller_stores_insert" on public.seller_stores
    for insert with check (
      exists (select 1 from public.sellers where id = seller_id and id = auth.uid())
    );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "seller_stores_update" on public.seller_stores
    for update using (
      exists (select 1 from public.sellers where id = seller_id and id = auth.uid())
    );
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- Fix broken RLS policies from 0005 (wrong column references)
-- ──────────────────────────────────────────────────────────────
do $$ begin
  -- support_ai_responses.user_id doesn't exist; join through ticket
  drop policy if exists "support responses readable by owner or admin"
    on public.support_ai_responses;
  create policy "support responses readable by owner"
    on public.support_ai_responses
    for select using (
      exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.user_id = auth.uid()
      )
    );
exception when others then null; end $$;

do $$ begin
  -- support_ticket_events.user_id doesn't exist; join through ticket
  drop policy if exists "support ticket events readable by owner or admin"
    on public.support_ticket_events;
  create policy "support ticket events readable by owner"
    on public.support_ticket_events
    for select using (
      exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.user_id = auth.uid()
      )
    );
exception when others then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- Storage: verification-documents bucket
-- ──────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('verification-documents', 'verification-documents', false)
on conflict (id) do nothing;

do $$ begin
  create policy "verification_documents_insert" on storage.objects
    for insert with check (
      bucket_id = 'verification-documents'
      and auth.role() = 'authenticated'
    );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "verification_documents_select_own" on storage.objects
    for select using (
      bucket_id = 'verification-documents'
      and auth.uid()::text = (storage.foldername(name))[2]
    );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "verification_documents_delete_own" on storage.objects
    for delete using (
      bucket_id = 'verification-documents'
      and auth.uid()::text = (storage.foldername(name))[2]
    );
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- Core functions & triggers
-- ──────────────────────────────────────────────────────────────

-- handle_new_user: auto-create profile on new auth user
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- handle_updated_at: generic updated_at bumper
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists listings_updated_at on public.listings;
create trigger listings_updated_at
  before update on public.listings
  for each row execute procedure public.handle_updated_at();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row execute procedure public.handle_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- increment_seller_sales (called from webhook handler)
create or replace function public.increment_seller_sales(seller_id uuid)
returns void as $$
begin
  update public.profiles set total_sales = total_sales + 1 where id = seller_id;
end;
$$ language plpgsql security definer;

-- sync_seller_verification_profile: keep profiles in sync with verifications
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

drop trigger if exists seller_verifications_sync_profile on public.seller_verifications;
create trigger seller_verifications_sync_profile
  after insert or update on public.seller_verifications
  for each row execute procedure public.sync_seller_verification_profile();

-- ensure_referral_code: auto-assign unique referral code on profile insert
create or replace function public.ensure_referral_code()
returns trigger as $$
declare
  base_code text;
  candidate_code text;
  suffix integer := 0;
begin
  if new.referral_code is not null and new.referral_code <> '' then
    return new;
  end if;
  base_code := upper(left(
    regexp_replace(
      coalesce(new.username, coalesce(new.full_name, 'TCG')),
      '[^A-Za-z0-9]', '', 'g'
    ), 8
  ));
  if base_code = '' then base_code := 'TCG'; end if;
  candidate_code := base_code;
  while exists (select 1 from public.profiles where referral_code = candidate_code) loop
    suffix := suffix + 1;
    candidate_code := base_code || suffix::text;
  end loop;
  new.referral_code := candidate_code;
  new.referral_code_created_at := now();
  new.referral_locked_at := now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists set_referral_code_on_profile on public.profiles;
create trigger set_referral_code_on_profile
  before insert on public.profiles
  for each row execute procedure public.ensure_referral_code();

-- capture_referral_source: read referral metadata from auth.users on signup
create or replace function public.capture_referral_source()
returns trigger as $$
declare
  referral_referrer uuid;
  referral_code_value text;
  referral_source_value text;
begin
  referral_referrer := null;
  referral_code_value := null;
  referral_source_value := null;

  if new.raw_user_meta_data ? 'referral_user_id' then
    referral_referrer := nullif(new.raw_user_meta_data->>'referral_user_id', '')::uuid;
    referral_source_value := 'referral link';
  elsif new.raw_user_meta_data ? 'referral_code' then
    referral_code_value := upper(trim(new.raw_user_meta_data->>'referral_code'));
    select id into referral_referrer from public.profiles
      where referral_code = referral_code_value limit 1;
    referral_source_value := 'referral code';
  elsif new.raw_user_meta_data ? 'invite_code' then
    referral_code_value := upper(trim(new.raw_user_meta_data->>'invite_code'));
    select id into referral_referrer from public.profiles
      where referral_code = referral_code_value limit 1;
    referral_source_value := 'invite code';
  elsif new.raw_user_meta_data ? 'creator_code' then
    referral_code_value := upper(trim(new.raw_user_meta_data->>'creator_code'));
    select id into referral_referrer from public.profiles
      where referral_code = referral_code_value limit 1;
    referral_source_value := 'creator/affiliate link';
  elsif new.raw_user_meta_data ? 'referred_by' then
    referral_code_value := upper(trim(new.raw_user_meta_data->>'referred_by'));
    select id into referral_referrer from public.profiles
      where referral_code = referral_code_value limit 1;
    referral_source_value := 'manual signup';
  end if;

  if referral_referrer is not null and referral_referrer <> new.id then
    update public.profiles
      set referral_source_user_id = referral_referrer,
          referral_source = referral_source_value,
          referral_source_code = referral_code_value,
          referral_source_confirmed_at = now(),
          referral_locked_at = coalesce(referral_locked_at, now())
      where id = new.id
        and referral_source_user_id is null;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists capture_referral_source_on_profile on auth.users;
create trigger capture_referral_source_on_profile
  after insert on auth.users
  for each row execute procedure public.capture_referral_source();

-- lock_referral_on_order: capture referral attribution when first order is placed
create or replace function public.lock_referral_on_order()
returns trigger as $$
declare
  current_referrer uuid;
  current_code text;
begin
  select referral_source_user_id, referral_source_code
    into current_referrer, current_code
  from public.profiles
  where id = new.buyer_id;

  if current_referrer is not null then
    insert into public.referral_attributions (
      referred_user_id, referrer_user_id, referral_code, signup_source,
      order_id, referral_program_id, program_type,
      fee_basis, reward_rate, reward_amount, company_kept_amount,
      total_revenue_generated, total_rewards_earned,
      status, metadata, first_transaction_at
    ) values (
      new.buyer_id, current_referrer,
      coalesce(current_code, ''),
      coalesce(
        (select referral_source from public.profiles where id = new.buyer_id),
        'manual signup'
      ),
      new.id, null, 'buyer',
      coalesce(new.marketplace_fee_amount, 0), 0, 0,
      coalesce(new.marketplace_fee_amount, 0), 0, 0,
      'held',
      jsonb_build_object('source', 'order trigger'),
      new.created_at
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists lock_referral_on_order_insert on public.orders;
create trigger lock_referral_on_order_insert
  after insert on public.orders
  for each row execute procedure public.lock_referral_on_order();

-- prevent_referral_changes: referral source is immutable once set
create or replace function public.prevent_referral_changes()
returns trigger as $$
begin
  if old.referral_source_user_id is distinct from new.referral_source_user_id then
    raise exception 'Referral ownership is locked';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists prevent_referral_source_change on public.profiles;
create trigger prevent_referral_source_change
  before update on public.profiles
  for each row execute procedure public.prevent_referral_changes();

-- ──────────────────────────────────────────────────────────────
-- Performance indexes
-- ──────────────────────────────────────────────────────────────
create index if not exists listings_seller_id_idx on public.listings(seller_id);
create index if not exists listings_status_idx on public.listings(status);
create index if not exists listings_category_idx on public.listings(category);
create index if not exists listings_price_idx on public.listings(price);
create index if not exists listings_card_name_fts_idx
  on public.listings using gin(to_tsvector('english', card_name));

create index if not exists orders_buyer_id_idx on public.orders(buyer_id);
create index if not exists orders_seller_id_idx on public.orders(seller_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_escrow_status_idx
  on public.orders(escrow_status) where escrow_status = 'held';
create index if not exists orders_stripe_payment_intent_idx
  on public.orders(stripe_payment_intent_id) where stripe_payment_intent_id is not null;

create index if not exists price_history_card_idx
  on public.price_history(card_name, set_name);

create index if not exists profiles_referral_code_idx
  on public.profiles(referral_code);
create index if not exists profiles_verification_status_idx
  on public.profiles(verification_status);
