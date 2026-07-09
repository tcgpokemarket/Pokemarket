create table if not exists public.referral_program_settings (
  id uuid primary key default gen_random_uuid(),
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
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.referral_programs (
  id uuid primary key default gen_random_uuid(),
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

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referred_user_id uuid references auth.users(id) on delete cascade not null,
  referrer_user_id uuid references auth.users(id) on delete cascade not null,
  order_id uuid references public.orders(id) on delete cascade,
  referral_program_id uuid references public.referral_programs(id) on delete set null,
  program_type text not null check (program_type in ('buyer', 'seller', 'creator', 'tiered')),
  fee_basis numeric(10,2) not null default 0,
  reward_rate numeric(5,2) not null default 0,
  reward_amount numeric(10,2) not null default 0,
  company_kept_amount numeric(10,2) not null default 0,
  hold_until timestamptz,
  status text not null default 'pending' check (status in ('pending', 'held', 'available', 'paid', 'rejected', 'adjusted')),
  fraud_flag boolean not null default false,
  fraud_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_attribution_id uuid references public.referral_attributions(id) on delete cascade not null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_attributions_referrer on public.referral_attributions (referrer_user_id, status);
create index if not exists idx_referral_attributions_referred on public.referral_attributions (referred_user_id, status);
create index if not exists idx_referral_attributions_hold_until on public.referral_attributions (hold_until);
create index if not exists idx_referral_programs_code on public.referral_programs (code);

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
