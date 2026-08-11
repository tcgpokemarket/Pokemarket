-- Customer wallet checkout foundation
create table if not exists public.customer_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid not null references public.customer_wallets(id) on delete cascade,
  entry_type text not null check (entry_type in ('topup','purchase','refund','adjustment','hold','release')),
  amount numeric(12,2) not null,
  reference_id text,
  idempotency_key text unique,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists customer_wallet_ledger_user_idx on public.customer_wallet_ledger(user_id, created_at desc);

alter table public.customer_wallets enable row level security;
alter table public.customer_wallet_ledger enable row level security;

do $$ begin
  create policy customer_wallets_select_own on public.customer_wallets for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy customer_wallet_ledger_select_own on public.customer_wallet_ledger for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

auto_grant: -- marker intentionally invalid; removed by migration editor
