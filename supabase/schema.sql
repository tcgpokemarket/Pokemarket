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
  seller_state text,
  seller_rating numeric(3,2) default 0,
  total_sales integer default 0,
  referral_code text unique,
  referral_code_created_at timestamptz,
  referral_source text,
  referral_source_user_id uuid references auth.users(id),
  referral_source_code text,
  referral_source_confirmed_at timestamptz,
  referral_locked_at timestamptz,
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
  shipping_paid_by text check (shipping_paid_by in ('buyer', 'seller')),
  weight_oz numeric(10,2),
  package_type text,
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

create table public.shipping_rules (
  id uuid default gen_random_uuid() primary key,
  weight_min numeric(10,2) not null,
  weight_max numeric(10,2),
  package_type text not null,
  usps_service text not null,
  shipping_price numeric(10,2) not null default 0,
  tracking_required boolean not null default true,
  active_status boolean not null default true,
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

create table public.show_products (
  id uuid default gen_random_uuid() primary key,
  show_id uuid references public.live_shows(id) on delete cascade not null,
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

create table public.live_bids (
  id uuid default gen_random_uuid() primary key,
  show_id uuid references public.live_shows(id) on delete cascade not null,
  product_id uuid references public.show_products(id) on delete cascade not null,
  bidder_id uuid references auth.users(id) on delete cascade not null,
  amount numeric(12,2) not null,
  is_auto_bid boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.show_bid_preferences (
  id uuid default gen_random_uuid() primary key,
  show_id uuid references public.live_shows(id) on delete cascade not null,
  product_id uuid references public.show_products(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  max_bid numeric(12,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (show_id, product_id, user_id)
);

create table public.live_chat (
  id uuid default gen_random_uuid() primary key,
  show_id uuid references public.live_shows(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  username text not null,
  message text not null,
  role text not null default 'viewer',
  highlighted boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.viewers (
  id uuid default gen_random_uuid() primary key,
  show_id uuid references public.live_shows(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  unique (show_id, user_id)
);

create table public.giveaways (
  id uuid default gen_random_uuid() primary key,
  show_id uuid references public.live_shows(id) on delete cascade not null,
  seller_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  prize_type text not null,
  prize_name text not null,
  prize_image text,
  prize_quantity integer not null default 1,
  winner_count integer not null default 1,
  start_at timestamptz not null,
  end_at timestamptz not null,
  eligibility text[] not null default '{}'::text[],
  follow_required boolean not null default false,
  location_restrictions text[] not null default '{}'::text[],
  age_restriction integer,
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

create table public.giveaway_entries (
  id uuid default gen_random_uuid() primary key,
  giveaway_id uuid references public.giveaways(id) on delete cascade not null,
  show_id uuid references public.live_shows(id) on delete cascade not null,
  seller_id uuid references auth.users(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  entry_status text not null default 'eligible',
  eligibility_status jsonb not null default '{}'::jsonb,
  following_seller boolean not null default false,
  winner_status text not null default 'pending',
  qualified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (giveaway_id, user_id)
);

create table public.giveaway_winners (
  id uuid default gen_random_uuid() primary key,
  giveaway_id uuid references public.giveaways(id) on delete cascade not null,
  entry_id uuid references public.giveaway_entries(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  seller_id uuid references auth.users(id) on delete cascade not null,
  selected_at timestamptz not null default now(),
  claimed_at timestamptz,
  claim_status text not null default 'pending',
  audit_log jsonb not null default '{}'::jsonb,
  unique (giveaway_id, user_id)
);

create table public.giveaway_follow_actions (
  id uuid default gen_random_uuid() primary key,
  giveaway_id uuid references public.giveaways(id) on delete cascade not null,
  seller_id uuid references auth.users(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  followed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (giveaway_id, user_id)
);

create table public.giveaway_audit_logs (
  id uuid default gen_random_uuid() primary key,
  giveaway_id uuid references public.giveaways(id) on delete cascade not null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.show_events (
  id uuid default gen_random_uuid() primary key,
  show_id uuid references public.live_shows(id) on delete cascade not null,
  event_type text not null,
  payload jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.sellers (
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

create table public.seller_followers (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.sellers(id) on delete cascade not null,
  follower_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (seller_id, follower_id)
);

create table public.seller_reviews (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.sellers(id) on delete cascade not null,
  buyer_id uuid references auth.users(id) on delete cascade not null,
  order_id uuid references public.orders(id) on delete set null,
  rating integer not null,
  title text,
  body text,
  created_at timestamptz not null default now()
);

create table public.seller_stores (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.sellers(id) on delete cascade not null,
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

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  related_user uuid references auth.users(id) on delete set null,
  related_content jsonb,
  read_status boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, receiver_id),
  check (requester_id <> receiver_id)
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.profile_privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  who_can_follow text not null default 'everyone' check (who_can_follow in ('everyone', 'followers_only', 'no_one')),
  who_can_friend_request text not null default 'everyone' check (who_can_friend_request in ('everyone', 'followers_only', 'no_one')),
  profile_visibility text not null default 'public' check (profile_visibility in ('public', 'followers_only', 'friends_only', 'private')),
  collection_visibility text not null default 'public' check (collection_visibility in ('public', 'followers_only', 'friends_only', 'private')),
  activity_visibility text not null default 'public' check (activity_visibility in ('public', 'followers_only', 'friends_only', 'private')),
  message_visibility text not null default 'followers_only' check (message_visibility in ('everyone', 'followers_only', 'friends_only', 'no_one')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_notifications_user_id on public.notifications (user_id, read_status, created_at desc);
create index idx_follows_follower_id on public.follows (follower_id, created_at desc);
create index idx_follows_following_id on public.follows (following_id, created_at desc);
create index idx_friendships_requester_id on public.friendships (requester_id, created_at desc);
create index idx_friendships_receiver_id on public.friendships (receiver_id, created_at desc);
create index idx_friendships_status on public.friendships (status, created_at desc);
create index idx_blocks_blocker_id on public.blocks (blocker_id, created_at desc);
create index idx_blocks_blocked_id on public.blocks (blocked_id, created_at desc);

alter table public.notifications enable row level security;
alter table public.follows enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.profile_privacy_settings enable row level security;

create policy "notifications are readable by owner" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications are insertable by staff" on public.notifications
  for insert with check (auth.uid() is not null);
create policy "notifications are updatable by owner" on public.notifications
  for update using (auth.uid() = user_id);

create policy "follows are readable by participants" on public.follows
  for select using (auth.uid() = follower_id or auth.uid() = following_id);
create policy "follows are insertable by follower" on public.follows
  for insert with check (auth.uid() = follower_id);
create policy "follows are deletable by follower" on public.follows
  for delete using (auth.uid() = follower_id);

create policy "friendships are readable by participants" on public.friendships
  for select using (auth.uid() = requester_id or auth.uid() = receiver_id);
create policy "friendships are insertable by requester" on public.friendships
  for insert with check (auth.uid() = requester_id);
create policy "friendships are updatable by participants" on public.friendships
  for update using (auth.uid() = requester_id or auth.uid() = receiver_id);
create policy "friendships are deletable by participants" on public.friendships
  for delete using (auth.uid() = requester_id or auth.uid() = receiver_id);

create policy "blocks are readable by blocker" on public.blocks
  for select using (auth.uid() = blocker_id or auth.uid() = blocked_id);
create policy "blocks are insertable by blocker" on public.blocks
  for insert with check (auth.uid() = blocker_id);
create policy "blocks are deletable by blocker" on public.blocks
  for delete using (auth.uid() = blocker_id);

create policy "privacy settings are readable by owner" on public.profile_privacy_settings
  for select using (auth.uid() = user_id);
create policy "privacy settings are insertable by owner" on public.profile_privacy_settings
  for insert with check (auth.uid() = user_id);
create policy "privacy settings are updatable by owner" on public.profile_privacy_settings
  for update using (auth.uid() = user_id);

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

create table public.referral_program_settings (
  id uuid default gen_random_uuid() primary key,
  buyer_reward_credit numeric(10,2) not null default 5,
  buyer_first_purchase_threshold numeric(10,2) not null default 25,
  buyer_credit_expiry_days integer not null default 90,
  buyer_reward_fee_share_percent numeric(5,2) not null default 10,
  buyer_reward_max_payout numeric(10,2) not null default 50,
  seller_reward_fee_share_percent numeric(5,2) not null default 15,
  seller_reward_max_payout numeric(10,2) not null default 250,
  creator_tier1_fee_share_percent numeric(5,2) not null default 20,
  creator_tier1_duration_days integer not null default 90,
  creator_tier1_max_payout numeric(10,2) not null default 500,
  creator_tier2_fee_share_percent numeric(5,2) not null default 25,
  creator_tier2_duration_days integer not null default 365,
  min_profit_margin_percent numeric(5,2) not null default 60,
  referral_hold_days integer not null default 14,
  minimum_withdrawal_amount numeric(10,2) not null default 25,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table public.referral_programs (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  owner_user_id uuid references auth.users(id) on delete cascade,
  program_type text not null check (program_type in ('buyer', 'seller', 'creator', 'tiered')),
  tier_name text,
  active boolean not null default true,
  approved boolean not null default false,
  commission_rate numeric(5,2) not null default 0,
  max_payout numeric(10,2),
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.referral_attributions (
  id uuid default gen_random_uuid() primary key,
  referred_user_id uuid references auth.users(id) on delete cascade not null,
  referrer_user_id uuid references auth.users(id) on delete cascade not null,
  referral_code text not null,
  signup_source text not null,
  order_id uuid references public.orders(id) on delete cascade,
  referral_program_id uuid references public.referral_programs(id) on delete set null,
  program_type text not null check (program_type in ('buyer', 'seller', 'creator', 'tiered')),
  fee_basis numeric(10,2) not null default 0,
  reward_rate numeric(5,2) not null default 0,
  reward_amount numeric(10,2) not null default 0,
  company_kept_amount numeric(10,2) not null default 0,
  total_revenue_generated numeric(10,2) not null default 0,
  total_rewards_earned numeric(10,2) not null default 0,
  hold_until timestamptz,
  status text not null default 'pending' check (status in ('pending', 'held', 'available', 'paid', 'rejected', 'adjusted')),
  fraud_flag boolean not null default false,
  fraud_reason text,
  metadata jsonb not null default '{}'::jsonb,
  first_transaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.referral_events (
  id uuid default gen_random_uuid() primary key,
  referral_attribution_id uuid references public.referral_attributions(id) on delete cascade not null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.seller_fee_settings enable row level security;
alter table public.seller_fee_tiers enable row level security;
alter table public.seller_fee_overrides enable row level security;
alter table public.audit_logs enable row level security;
alter table public.security_events enable row level security;
alter table public.device_sessions enable row level security;
alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;
alter table public.ip_reports enable row level security;
alter table public.dispute_records enable row level security;
alter table public.sellers enable row level security;
alter table public.seller_followers enable row level security;
alter table public.seller_reviews enable row level security;
alter table public.seller_stores enable row level security;

create policy "seller_fee_settings_select" on public.seller_fee_settings for select using (auth.uid() is not null);
create policy "seller_fee_tiers_select" on public.seller_fee_tiers for select using (auth.uid() is not null);
create policy "seller_fee_overrides_select_own" on public.seller_fee_overrides for select using (auth.uid() = seller_id);
create policy "audit_logs_insert" on public.audit_logs for insert with check (true);
create policy "security_events_insert" on public.security_events for insert with check (true);
create policy "device_sessions_select_own" on public.device_sessions for select using (auth.uid() = user_id);
create policy "device_sessions_insert_own" on public.device_sessions for insert with check (auth.uid() = user_id);
create policy "device_sessions_update_own" on public.device_sessions for update using (auth.uid() = user_id);
create policy "legal_documents_select" on public.legal_documents for select using (active = true);
create policy "legal_acceptances_select_own" on public.legal_acceptances for select using (auth.uid() = user_id);
create policy "legal_acceptances_insert_own" on public.legal_acceptances for insert with check (auth.uid() = user_id);
create policy "ip_reports_insert" on public.ip_reports for insert with check (auth.uid() is not null);
create policy "ip_reports_select_own" on public.ip_reports for select using (auth.uid() = reporter_id);
create policy "dispute_records_select" on public.dispute_records for select using (auth.uid() = user_id or exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "sellers_select" on public.sellers for select using (true);
create policy "sellers_insert_own" on public.sellers for insert with check (auth.uid() = id);
create policy "sellers_update_own" on public.sellers for update using (auth.uid() = id);
create policy "seller_followers_select" on public.seller_followers for select using (true);
create policy "seller_followers_insert" on public.seller_followers for insert with check (auth.uid() = follower_id);
create policy "seller_followers_delete" on public.seller_followers for delete using (auth.uid() = follower_id);
create policy "seller_reviews_select" on public.seller_reviews for select using (true);
create policy "seller_reviews_insert" on public.seller_reviews for insert with check (auth.uid() = buyer_id);
create policy "seller_stores_select" on public.seller_stores for select using (true);
create policy "seller_stores_insert" on public.seller_stores for insert with check (exists (select 1 from public.sellers where id = seller_id and id = auth.uid()));
create policy "seller_stores_update" on public.seller_stores for update using (exists (select 1 from public.sellers where id = seller_id and id = auth.uid()));

create index idx_referral_attributions_referrer on public.referral_attributions(referrer_user_id, status);
create index idx_referral_attributions_referred on public.referral_attributions(referred_user_id, status);
create index idx_referral_attributions_hold_until on public.referral_attributions(hold_until);
create index idx_referral_attributions_code on public.referral_attributions(referral_code);
create index idx_referral_programs_code on public.referral_programs(code);
create index idx_profiles_referral_code on public.profiles(referral_code);

alter table public.referral_program_settings enable row level security;
alter table public.referral_programs enable row level security;
alter table public.referral_attributions enable row level security;
alter table public.referral_events enable row level security;

create policy "referral settings readable by authenticated users" on public.referral_program_settings
  for select using (auth.uid() is not null);
create policy "referral programs readable by authenticated users" on public.referral_programs
  for select using (auth.uid() is not null);
create policy "referral attributions readable by participants" on public.referral_attributions
  for select using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);
create policy "referral events readable by participants" on public.referral_events
  for select using (exists (select 1 from public.referral_attributions where id = referral_attribution_id and (referrer_user_id = auth.uid() or referred_user_id = auth.uid())));

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

  base_code := upper(left(regexp_replace(coalesce(new.username, coalesce(new.full_name, 'TCG')), '[^A-Za-z0-9]', '', 'g'), 8));
  if base_code = '' then
    base_code := 'TCG';
  end if;
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

create trigger set_referral_code_on_profile
  before insert on public.profiles
  for each row execute procedure public.ensure_referral_code();

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
    select id into referral_referrer from public.profiles where referral_code = referral_code_value limit 1;
    referral_source_value := 'referral code';
  elsif new.raw_user_meta_data ? 'invite_code' then
    referral_code_value := upper(trim(new.raw_user_meta_data->>'invite_code'));
    select id into referral_referrer from public.profiles where referral_code = referral_code_value limit 1;
    referral_source_value := 'invite code';
  elsif new.raw_user_meta_data ? 'creator_code' then
    referral_code_value := upper(trim(new.raw_user_meta_data->>'creator_code'));
    select id into referral_referrer from public.profiles where referral_code = referral_code_value limit 1;
    referral_source_value := 'creator/affiliate link';
  elsif new.raw_user_meta_data ? 'referred_by' then
    referral_code_value := upper(trim(new.raw_user_meta_data->>'referred_by'));
    select id into referral_referrer from public.profiles where referral_code = referral_code_value limit 1;
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

create trigger capture_referral_source_on_profile
  after insert on auth.users
  for each row execute procedure public.capture_referral_source();

create or replace function public.lock_referral_on_order()
returns trigger as $$
declare
  current_referrer uuid;
  current_code text;
begin
  select referral_source_user_id, referral_source_code into current_referrer, current_code
  from public.profiles
  where id = new.buyer_id;

  if current_referrer is not null then
    insert into public.referral_attributions (
      referred_user_id,
      referrer_user_id,
      referral_code,
      signup_source,
      order_id,
      referral_program_id,
      program_type,
      fee_basis,
      reward_rate,
      reward_amount,
      company_kept_amount,
      total_revenue_generated,
      total_rewards_earned,
      status,
      metadata,
      first_transaction_at
    )
    values (
      new.buyer_id,
      current_referrer,
      coalesce(current_code, ''),
      coalesce((select referral_source from public.profiles where id = new.buyer_id), 'manual signup'),
      new.id,
      null,
      'buyer',
      coalesce(new.marketplace_fee_amount, 0),
      0,
      0,
      coalesce(new.marketplace_fee_amount, 0),
      0,
      'held',
      jsonb_build_object('source', 'order trigger'),
      new.created_at
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger lock_referral_on_order_insert
  after insert on public.orders
  for each row execute procedure public.lock_referral_on_order();

create or replace function public.prevent_referral_changes()
returns trigger as $$
begin
  if old.referral_source_user_id is distinct from new.referral_source_user_id then
    raise exception 'Referral ownership is locked';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger prevent_referral_source_change
  before update on public.profiles
  for each row execute procedure public.prevent_referral_changes();

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

create table public.webhook_events (
  id uuid default gen_random_uuid() primary key,
  event_type text not null,
  provider_event_id text,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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

create table public.legal_documents (
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

create table public.legal_acceptances (
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

create table public.ip_reports (
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

create table public.dispute_records (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  dispute_type text not null,
  status text not null default 'open',
  details text,
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
create index if not exists listings_card_name_fts_idx on public.listings using gin(to_tsvector('english', card_name));
create index orders_buyer_id_idx on public.orders(buyer_id);
create index orders_seller_id_idx on public.orders(seller_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_escrow_status_idx on public.orders(escrow_status) where escrow_status = 'held';
create index if not exists orders_stripe_payment_intent_idx on public.orders(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index price_history_card_idx on public.price_history(card_name, set_name);
create index if not exists profiles_referral_code_idx on public.profiles(referral_code);
create index if not exists profiles_verification_status_idx on public.profiles(verification_status);

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
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);
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

alter table public.shipping_profiles enable row level security;
alter table public.seller_wallets enable row level security;
alter table public.shipment_groups enable row level security;
alter table public.shipments enable row level security;
alter table public.tracking_events enable row level security;
alter table public.escrow_ledger enable row level security;
alter table public.escrow_disputes enable row level security;
alter table public.escrow_release_jobs enable row level security;

create policy "shipping_profiles_select_own" on public.shipping_profiles for select using (auth.uid() = seller_id);
create policy "shipping_profiles_insert_own" on public.shipping_profiles for insert with check (auth.uid() = seller_id);
create policy "shipping_profiles_update_own" on public.shipping_profiles for update using (auth.uid() = seller_id);
create policy "shipping_profiles_delete_own" on public.shipping_profiles for delete using (auth.uid() = seller_id);

create policy "shipment_groups_select" on public.shipment_groups for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "shipment_groups_insert" on public.shipment_groups for insert with check (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "shipment_groups_update" on public.shipment_groups for update using (auth.uid() = seller_id);

create policy "shipments_select" on public.shipments for select using (exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "tracking_events_select" on public.tracking_events for select using (exists (select 1 from public.shipments s join public.orders o on o.id = s.order_id where s.id = shipment_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));

create policy "seller_wallets_select" on public.seller_wallets for select using (auth.uid() = seller_id);
create policy "seller_wallets_update" on public.seller_wallets for update using (false);
create policy "escrow_ledger_select" on public.escrow_ledger for select using (auth.uid() = seller_id or exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "escrow_disputes_select" on public.escrow_disputes for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "escrow_release_jobs_select" on public.escrow_release_jobs for select using (auth.uid() = seller_id);

-- Price history (public read)
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

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- Increment seller sales count (called from webhook handler)
create or replace function public.increment_seller_sales(seller_id uuid)
returns void as $$
begin
  update public.profiles set total_sales = total_sales + 1 where id = seller_id;
end;
$$ language plpgsql security definer;

create table public.auction_orders (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.live_shows(id) on delete cascade,
  product_id uuid not null references public.show_products(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references public.listings(id) on delete set null,
  winning_bid numeric(12,2) not null,
  payment_status text not null default 'payment_pending' check (payment_status in ('payment_pending', 'paid', 'failed', 'expired', 'cancelled')),
  payment_deadline timestamptz not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auction_id, product_id)
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.auction_orders(id) on delete cascade,
  stripe_event_id text not null unique,
  status text not null,
  timestamp timestamptz not null default now()
);

create index if not exists idx_auction_orders_seller_payment_status on public.auction_orders (seller_id, payment_status, payment_deadline);
create index if not exists idx_auction_orders_buyer_payment_status on public.auction_orders (buyer_id, payment_status, payment_deadline);
create index if not exists idx_payment_events_order_id on public.payment_events (order_id, timestamp desc);

alter table public.auction_orders enable row level security;
alter table public.payment_events enable row level security;

create policy "auction orders readable by participants" on public.auction_orders
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "auction orders insertable by staff" on public.auction_orders
  for insert with check (auth.uid() is not null);
create policy "auction orders updatable by participants or staff" on public.auction_orders
  for update using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "payment events readable by participants" on public.payment_events
  for select using (exists (select 1 from public.auction_orders where id = order_id and (buyer_id = auth.uid() or seller_id = auth.uid())));
create policy "payment events insertable by staff" on public.payment_events
  for insert with check (auth.uid() is not null);

create table public.email_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notification_type)
);

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  template_name text not null unique,
  subject text not null,
  content text not null,
  variables jsonb not null default '[]'::jsonb,
  category text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email_type text not null,
  template_name text,
  recipient_email text not null,
  status text not null,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  template_name text not null,
  recipient_email text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed', 'canceled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text,
  context_type text,
  context_id uuid,
  is_archived boolean not null default false
);

create table public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  muted boolean not null default false,
  archived boolean not null default false,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  attachment_url text,
  attachment_type text,
  context jsonb not null default '{}'::jsonb,
  read_status boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.message_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

create table public.message_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

create table public.message_access_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  allow_followers boolean not null default true,
  allow_friends boolean not null default true,
  allow_sellers boolean not null default true,
  allow_buyer_support boolean not null default true,
  allow_admin_messages boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.rewards_program_settings (
  id uuid primary key default gen_random_uuid(),
  signup_bonus_points integer not null default 50,
  daily_login_bonus_points integer not null default 5,
  purchase_points_per_dollar numeric(10,2) not null default 1,
  seller_sale_points_per_dollar numeric(10,2) not null default 1,
  live_bid_points_per_bid integer not null default 2,
  referral_points_per_successful_referral integer not null default 100,
  referral_purchase_bonus_points integer not null default 50,
  admin_bonus_points_per_action integer not null default 25,
  points_to_wallet_credit_rate numeric(10,2) not null default 0.01,
  minimum_redemption_points integer not null default 100,
  point_expiry_days integer not null default 365,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rewards_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available_points integer not null default 0,
  pending_points integer not null default 0,
  redeemed_points integer not null default 0,
  lifetime_points integer not null default 0,
  last_login_bonus_at timestamptz,
  points_expire_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.rewards_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  order_id uuid references public.orders(id) on delete cascade,
  live_show_id uuid references public.live_shows(id) on delete cascade,
  referral_attribution_id uuid references public.referral_attributions(id) on delete set null,
  redemption_id uuid,
  entry_type text not null check (entry_type in ('signup_bonus', 'daily_login', 'purchase', 'seller_sale', 'live_bid', 'referral_reward', 'referral_purchase_bonus', 'admin_bonus', 'redemption', 'expiration_adjustment', 'manual_adjustment')),
  status text not null default 'posted' check (status in ('pending', 'posted', 'held', 'failed', 'reversed')),
  points integer not null,
  balance_after integer not null,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.rewards_redemption_options (
  id uuid primary key default gen_random_uuid(),
  option_key text not null unique,
  display_name text not null,
  redemption_type text not null check (redemption_type in ('wallet_credit', 'coupon', 'discount')),
  points_cost integer not null,
  credit_amount numeric(10,2),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rewards_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  option_id uuid references public.rewards_redemption_options(id) on delete set null,
  points_spent integer not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'fulfilled', 'rejected', 'cancelled')),
  fulfillment_reference text,
  fulfillment_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

create index if not exists idx_rewards_ledger_user_created_at on public.rewards_ledger (user_id, created_at desc);
create index if not exists idx_rewards_ledger_entry_type on public.rewards_ledger (entry_type, created_at desc);
create index if not exists idx_rewards_redemptions_user_created_at on public.rewards_redemptions (user_id, created_at desc);
create index if not exists idx_rewards_redemption_options_active on public.rewards_redemption_options (active, points_cost);

create index if not exists idx_email_preferences_user_id on public.email_preferences (user_id, notification_type);
create index if not exists idx_email_logs_user_id on public.email_logs (user_id, sent_at desc);
create index if not exists idx_email_queue_status on public.email_queue (status, next_attempt_at);
create index if not exists idx_conversations_last_message_at on public.conversations (last_message_at desc nulls last);
create index if not exists idx_conversation_members_user_id on public.conversation_members (user_id, created_at desc);
create index if not exists idx_messages_conversation_id on public.messages (conversation_id, created_at desc);
create index if not exists idx_message_recipients_user_id on public.message_recipients (user_id, created_at desc);
create index if not exists idx_message_reports_status on public.message_reports (status, created_at desc);
create index if not exists idx_message_blocks_blocker_id on public.message_blocks (blocker_id, created_at desc);

alter table public.email_preferences enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_logs enable row level security;
alter table public.email_queue enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_recipients enable row level security;
alter table public.message_reports enable row level security;
alter table public.message_blocks enable row level security;
alter table public.message_access_rules enable row level security;
alter table public.rewards_program_settings enable row level security;
alter table public.rewards_accounts enable row level security;
alter table public.rewards_ledger enable row level security;
alter table public.rewards_redemption_options enable row level security;
alter table public.rewards_redemptions enable row level security;

create policy "email preferences are readable by owner" on public.email_preferences
  for select using (auth.uid() = user_id);
create policy "email preferences are insertable by owner" on public.email_preferences
  for insert with check (auth.uid() = user_id);
create policy "email preferences are updatable by owner" on public.email_preferences
  for update using (auth.uid() = user_id);

create policy "email templates are readable by admins" on public.email_templates
  for select using (false);
create policy "email logs are readable by owner or admin" on public.email_logs
  for select using (auth.uid() = user_id);
create policy "email queue is readable by admin" on public.email_queue
  for select using (false);

create policy "conversations are readable by members" on public.conversations
  for select using (exists (select 1 from public.conversation_members where conversation_id = id and user_id = auth.uid()));
create policy "conversations are insertable by authenticated users" on public.conversations
  for insert with check (auth.uid() is not null);
create policy "conversations are updatable by members" on public.conversations
  for update using (exists (select 1 from public.conversation_members where conversation_id = id and user_id = auth.uid()));

create policy "conversation members are readable by members" on public.conversation_members
  for select using (exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = auth.uid()));
create policy "conversation members are insertable by authenticated users" on public.conversation_members
  for insert with check (auth.uid() is not null);
create policy "conversation members are updatable by members" on public.conversation_members
  for update using (user_id = auth.uid() or exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = auth.uid()));

create policy "messages are readable by members" on public.messages
  for select using (exists (select 1 from public.conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid()));
create policy "messages are insertable by conversation members" on public.messages
  for insert with check (exists (select 1 from public.conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid()));
create policy "messages are updatable by sender or members" on public.messages
  for update using (sender_id = auth.uid() or exists (select 1 from public.conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid()));

create policy "message recipients are readable by recipient" on public.message_recipients
  for select using (user_id = auth.uid());
create policy "message recipients are insertable by message senders" on public.message_recipients
  for insert with check (auth.uid() is not null);
create policy "message recipients are updatable by recipient" on public.message_recipients
  for update using (user_id = auth.uid());

create policy "message reports are readable by reporters or admin" on public.message_reports
  for select using (reporter_id = auth.uid());
create policy "message reports are insertable by authenticated users" on public.message_reports
  for insert with check (auth.uid() = reporter_id);
create policy "message reports are updatable by admin" on public.message_reports
  for update using (false);

create policy "message blocks are readable by blocker" on public.message_blocks
  for select using (blocker_id = auth.uid() or blocked_id = auth.uid());
create policy "message blocks are insertable by blocker" on public.message_blocks
  for insert with check (auth.uid() = blocker_id);
create policy "message blocks are deletable by blocker" on public.message_blocks
  for delete using (auth.uid() = blocker_id);

create policy "message access rules are readable by owner" on public.message_access_rules
  for select using (auth.uid() = user_id);
create policy "message access rules are insertable by owner" on public.message_access_rules
  for insert with check (auth.uid() = user_id);
create policy "message access rules are updatable by owner" on public.message_access_rules
  for update using (auth.uid() = user_id);

create policy "rewards settings readable by authenticated users" on public.rewards_program_settings
  for select using (auth.uid() is not null);
create policy "reward accounts readable by owner" on public.rewards_accounts
  for select using (auth.uid() = user_id);
create policy "reward ledger readable by owner" on public.rewards_ledger
  for select using (auth.uid() = user_id);
create policy "reward redemption options readable by authenticated users" on public.rewards_redemption_options
  for select using (auth.uid() is not null);
create policy "reward redemptions readable by owner" on public.rewards_redemptions
  for select using (auth.uid() = user_id);

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

alter table public.webhook_events enable row level security;
alter table public.seller_verifications enable row level security;
alter table public.seller_verification_documents enable row level security;
alter table public.seller_verification_history enable row level security;

create policy "webhook_events_insert" on public.webhook_events for insert with check (true);

create policy "seller_verifications_select_own" on public.seller_verifications for select using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));
create policy "seller_verifications_insert_own" on public.seller_verifications for insert with check (auth.uid() = user_id);
create policy "seller_verifications_update_own" on public.seller_verifications for update using (auth.uid() = user_id);
create policy "seller_verification_documents_select_own" on public.seller_verification_documents for select using (auth.uid() = user_id or exists (select 1 from public.seller_verifications v where v.id = verification_id and v.user_id = auth.uid()));
create policy "seller_verification_documents_insert_own" on public.seller_verification_documents for insert with check (auth.uid() = user_id);
create policy "seller_verification_history_select" on public.seller_verification_history for select using (auth.uid() = actor_id or exists (select 1 from public.seller_verifications v where v.id = verification_id and v.user_id = auth.uid()));

alter table public.profiles add column if not exists shipping_address jsonb;
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
