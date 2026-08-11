-- 0021_repair_missing_seller_social_tables.sql
-- Restores tables referenced by production UI but absent from the database.
create table if not exists public.sellers (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  storefront_slug text unique,
  bio text,
  avatar_url text,
  banner_url text,
  verified boolean not null default false,
  rating numeric(4,2) not null default 0,
  follower_count integer not null default 0,
  sales_count integer not null default 0,
  total_revenue numeric(12,2) not null default 0,
  total_listings integer not null default 0,
  total_live_shows integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_stores (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  description text,
  banner_url text,
  logo_url text,
  theme jsonb,
  verified boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_verifications (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'not_started',
  legal_name text,
  date_of_birth date,
  phone text,
  address jsonb,
  document_type text,
  document_status text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  read boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists sellers_slug_idx on public.sellers(storefront_slug);
create index if not exists seller_stores_slug_idx on public.seller_stores(slug);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists messages_recipient_created_idx on public.messages(recipient_id, created_at desc);

alter table public.sellers enable row level security;
alter table public.seller_stores enable row level security;
alter table public.seller_verifications enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;

do $$ begin
  create policy sellers_select_public on public.sellers for select using (true);
  create policy sellers_insert_own on public.sellers for insert with check (auth.uid() = id);
  create policy sellers_update_own on public.sellers for update using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy seller_stores_select_public on public.seller_stores for select using (true);
  create policy seller_stores_insert_own on public.seller_stores for insert with check (auth.uid() = seller_id);
  create policy seller_stores_update_own on public.seller_stores for update using (auth.uid() = seller_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy seller_verifications_select_own on public.seller_verifications for select using (auth.uid() = seller_id);
  create policy seller_verifications_insert_own on public.seller_verifications for insert with check (auth.uid() = seller_id);
  create policy seller_verifications_update_own on public.seller_verifications for update using (auth.uid() = seller_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy notifications_select_own on public.notifications for select using (auth.uid() = user_id);
  create policy notifications_update_own on public.notifications for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy messages_select_participant on public.messages for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
  create policy messages_insert_sender on public.messages for insert with check (auth.uid() = sender_id);
  create policy messages_update_participant on public.messages for update using (auth.uid() = sender_id or auth.uid() = recipient_id);
exception when duplicate_object then null; end $$;
