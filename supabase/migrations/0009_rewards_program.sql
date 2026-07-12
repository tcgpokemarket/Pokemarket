create table if not exists public.rewards_program_settings (
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

create table if not exists public.rewards_accounts (
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

create table if not exists public.rewards_ledger (
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

create table if not exists public.rewards_redemption_options (
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

create table if not exists public.rewards_redemptions (
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

alter table public.rewards_program_settings enable row level security;
alter table public.rewards_accounts enable row level security;
alter table public.rewards_ledger enable row level security;
alter table public.rewards_redemption_options enable row level security;
alter table public.rewards_redemptions enable row level security;

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

insert into public.rewards_program_settings (id)
select gen_random_uuid()
where not exists (select 1 from public.rewards_program_settings);

insert into public.rewards_redemption_options (option_key, display_name, redemption_type, points_cost, credit_amount, metadata)
select * from (values
  ('wallet-credit-5', 'Wallet credit $5', 'wallet_credit', 500, 5, '{}'::jsonb),
  ('wallet-credit-10', 'Wallet credit $10', 'wallet_credit', 900, 10, '{}'::jsonb),
  ('coupon-10', '10% off coupon', 'coupon', 750, null, '{"coupon_percent":10}'::jsonb),
  ('coupon-15', '15% off coupon', 'coupon', 1250, null, '{"coupon_percent":15}'::jsonb),
  ('discount-25', '$25 discount', 'discount', 1800, 25, '{}'::jsonb)
) as seeded(option_key, display_name, redemption_type, points_cost, credit_amount, metadata)
where not exists (
  select 1 from public.rewards_redemption_options existing where existing.option_key = seeded.option_key
);

create or replace function public.sync_rewards_account_default()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.rewards_accounts (user_id, available_points, pending_points, redeemed_points, lifetime_points, points_expire_at)
  values (new.id, 0, 0, 0, 0, now() + interval '365 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function public.bump_rewards_account_points(
  p_user_id uuid,
  p_points integer,
  p_entry_type text,
  p_status text,
  p_order_id uuid default null,
  p_live_show_id uuid default null,
  p_referral_attribution_id uuid default null,
  p_expires_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null
)
returns public.rewards_ledger
language plpgsql
security definer
as $$
declare
  current_points integer;
  new_balance integer;
  account_row public.rewards_accounts%rowtype;
  ledger_row public.rewards_ledger%rowtype;
begin
  insert into public.rewards_accounts (user_id, available_points, pending_points, redeemed_points, lifetime_points, points_expire_at)
  values (p_user_id, 0, 0, 0, 0, now() + interval '365 days')
  on conflict (user_id) do nothing;

  select coalesce(available_points, 0) into current_points
  from public.rewards_accounts
  where user_id = p_user_id
  for update;

  new_balance := greatest(coalesce(current_points, 0) + p_points, 0);

  update public.rewards_accounts
    set available_points = new_balance,
        pending_points = greatest(coalesce(pending_points, 0), 0),
        lifetime_points = greatest(coalesce(lifetime_points, 0) + greatest(p_points, 0), 0),
        points_expire_at = coalesce(p_expires_at, points_expire_at, now() + interval '365 days'),
        updated_at = now()
  where user_id = p_user_id
  returning * into account_row;

  insert into public.rewards_ledger (user_id, order_id, live_show_id, referral_attribution_id, entry_type, status, points, balance_after, expires_at, metadata, created_by)
  values (p_user_id, p_order_id, p_live_show_id, p_referral_attribution_id, p_entry_type, p_status, p_points, new_balance, p_expires_at, coalesce(p_metadata, '{}'::jsonb), p_created_by)
  returning * into ledger_row;

  return ledger_row;
end;
$$;

create or replace function public.handle_rewards_account_bootstrap()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.rewards_accounts (user_id, available_points, pending_points, redeemed_points, lifetime_points, points_expire_at)
  values (new.id, 0, 0, 0, 0, now() + interval '365 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger create_rewards_account_on_profile
  after insert on auth.users
  for each row execute procedure public.handle_rewards_account_bootstrap();

create trigger create_rewards_account_on_signup_profile
  after insert on public.profiles
  for each row execute procedure public.sync_rewards_account_default();
