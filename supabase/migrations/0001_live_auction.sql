create table if not exists public.live_shows (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  thumbnail text,
  status text not null default 'scheduled',
  auction_state text default 'upcoming',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  viewer_count integer not null default 0,
  peak_viewers integer not null default 0,
  total_sales_amount numeric(12,2) not null default 0,
  total_bidders integer not null default 0,
  average_bid_value numeric(12,2) not null default 0,
  engagement_score integer not null default 0,
  host_permissions text[] default '{}'::text[],
  auction_settings jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.show_products (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.live_shows(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  title text not null,
  subtitle text,
  image_url text,
  start_price numeric(12,2) not null default 0,
  buy_now_price numeric(12,2),
  current_bid numeric(12,2) not null default 0,
  bid_count integer not null default 0,
  auction_seconds integer not null default 30,
  seconds_left integer not null default 30,
  pinned boolean not null default false,
  sold boolean not null default false,
  passed boolean not null default false,
  winner_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_bids (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.live_shows(id) on delete cascade,
  product_id uuid not null references public.show_products(id) on delete cascade,
  bidder_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null,
  is_auto_bid boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.live_chat (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.live_shows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  message text not null,
  role text not null default 'viewer',
  highlighted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.viewers (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.live_shows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  unique (show_id, user_id)
);

create table if not exists public.giveaways (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.live_shows(id) on delete cascade,
  title text not null,
  prize_type text not null,
  prize_name text not null,
  prize_quantity integer not null default 1,
  winner_count integer not null default 1,
  start_at timestamptz not null,
  end_at timestamptz not null,
  eligibility text[] not null default '{}'::text[],
  eligible_users integer not null default 0,
  claimed_winners integer not null default 0,
  live_entries integer not null default 0,
  total_entries integer not null default 0,
  estimated_item_value numeric(12,2) not null default 0,
  platform_processing_fee numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  seller_budget numeric(12,2) not null default 0,
  seller_pays_all_fees boolean not null default true,
  status text not null default 'draft',
  winner_ids uuid[] not null default '{}'::uuid[],
  fraud_flags integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.show_events (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.live_shows(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sellers (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  storefront_slug text not null unique,
  bio text,
  avatar_url text,
  banner_url text,
  verified boolean not null default false,
  rating numeric(3,2) not null default 0,
  follower_count integer not null default 0,
  sales_count integer not null default 0,
  total_revenue numeric(12,2) not null default 0,
  total_listings integer not null default 0,
  total_live_shows integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_followers (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  follower_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (seller_id, follower_id)
);

create table if not exists public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  rating integer not null,
  title text,
  body text,
  created_at timestamptz not null default now()
);

create table if not exists public.seller_stores (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  banner_url text,
  logo_url text,
  theme jsonb not null default '{}'::jsonb,
  verified boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_live_shows_seller_id on public.live_shows (seller_id);
create index if not exists idx_live_shows_status on public.live_shows (status);
create index if not exists idx_show_products_show_id on public.show_products (show_id, sort_order);
create index if not exists idx_live_bids_show_id on public.live_bids (show_id, created_at desc);
create index if not exists idx_live_chat_show_id on public.live_chat (show_id, created_at asc);
create index if not exists idx_viewers_show_id on public.viewers (show_id, active);
create index if not exists idx_giveaways_show_id on public.giveaways (show_id, created_at desc);
create index if not exists idx_show_events_show_id on public.show_events (show_id, created_at desc);

alter table public.live_shows enable row level security;
alter table public.show_products enable row level security;
alter table public.live_bids enable row level security;
alter table public.live_chat enable row level security;
alter table public.viewers enable row level security;
alter table public.giveaways enable row level security;
alter table public.show_events enable row level security;

create policy "live shows are readable" on public.live_shows
  for select using (true);

create policy "show products are readable" on public.show_products
  for select using (true);

create policy "bids are readable" on public.live_bids
  for select using (true);

create policy "chat is readable" on public.live_chat
  for select using (true);

create policy "viewers are readable" on public.viewers
  for select using (true);

create policy "giveaways are readable" on public.giveaways
  for select using (true);

create policy "events are readable" on public.show_events
  for select using (true);

create policy "live shows are insertable by sellers" on public.live_shows
  for insert with check (auth.uid() = seller_id);

create policy "show products are insertable by sellers" on public.show_products
  for insert with check (exists (select 1 from public.live_shows where id = show_id and seller_id = auth.uid()));

create policy "bids are insertable by logged in users" on public.live_bids
  for insert with check (auth.uid() = bidder_id);

create policy "chat is insertable by logged in users" on public.live_chat
  for insert with check (auth.uid() = user_id);

create policy "viewers are insertable by logged in users" on public.viewers
  for insert with check (auth.uid() = user_id);

create policy "giveaways are insertable by sellers" on public.giveaways
  for insert with check (exists (select 1 from public.live_shows where id = show_id and seller_id = auth.uid()));

create policy "events are insertable by staff" on public.show_events
  for insert with check (auth.uid() is not null);
