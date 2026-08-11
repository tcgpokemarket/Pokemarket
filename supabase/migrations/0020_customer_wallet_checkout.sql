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
  create policy customer_wallets_select_own on public.customer_wallets
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy customer_wallet_ledger_select_own on public.customer_wallet_ledger
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create or replace function public.wallet_debit_customer(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id text default null,
  p_idempotency_key text default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.customer_wallets%rowtype;
  v_new_balance numeric(12,2);
begin
  if p_user_id <> auth.uid() then raise exception 'unauthorized'; end if;
  if p_amount <= 0 then raise exception 'invalid_amount'; end if;

  insert into public.customer_wallets(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  if p_idempotency_key is not null and exists (
    select 1 from public.customer_wallet_ledger
    where idempotency_key = p_idempotency_key and user_id = p_user_id
  ) then
    select balance into v_new_balance from public.customer_wallets where user_id = p_user_id;
    return v_new_balance;
  end if;

  select * into v_wallet from public.customer_wallets where user_id = p_user_id for update;
  if v_wallet.balance < p_amount then raise exception 'insufficient_wallet_balance'; end if;
  v_new_balance := v_wallet.balance - p_amount;

  update public.customer_wallets set balance = v_new_balance, updated_at = now() where user_id = p_user_id;
  insert into public.customer_wallet_ledger(user_id, wallet_id, entry_type, amount, reference_id, idempotency_key, note)
  values (p_user_id, v_wallet.id, 'purchase', -p_amount, p_reference_id, p_idempotency_key, 'Wallet checkout purchase');

  return v_new_balance;
end;
$$;

grant execute on function public.wallet_debit_customer(uuid,numeric,text,text) to authenticated;
