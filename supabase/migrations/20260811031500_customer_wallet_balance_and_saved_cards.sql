create table if not exists public.customer_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('topup','purchase','refund','adjustment','hold','release')),
  amount numeric(12,2) not null check (amount > 0),
  balance_after numeric(12,2) not null check (balance_after >= 0),
  reference_id text,
  idempotency_key text unique,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists customer_wallet_ledger_user_created_idx on public.customer_wallet_ledger(user_id, created_at desc);
alter table public.customer_wallets enable row level security;
alter table public.customer_wallet_ledger enable row level security;
drop policy if exists "wallet owner read" on public.customer_wallets;
create policy "wallet owner read" on public.customer_wallets for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "wallet ledger owner read" on public.customer_wallet_ledger;
create policy "wallet ledger owner read" on public.customer_wallet_ledger for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.wallet_credit_topup(p_user_id uuid, p_amount numeric, p_idempotency_key text, p_reference_id text default null, p_description text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_balance numeric(12,2); v_new numeric(12,2);
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'idempotency key required'; end if;
  if exists (select 1 from public.customer_wallet_ledger where idempotency_key = p_idempotency_key) then
    select balance into v_balance from public.customer_wallets where user_id = p_user_id; return coalesce(v_balance,0);
  end if;
  insert into public.customer_wallets(user_id,balance) values(p_user_id,0) on conflict(user_id) do nothing;
  select balance into v_balance from public.customer_wallets where user_id=p_user_id for update;
  v_new := v_balance + round(p_amount,2);
  update public.customer_wallets set balance=v_new, updated_at=now() where user_id=p_user_id;
  insert into public.customer_wallet_ledger(user_id,entry_type,amount,balance_after,reference_id,idempotency_key,description) values(p_user_id,'topup',round(p_amount,2),v_new,p_reference_id,p_idempotency_key,p_description);
  return v_new;
end; $$;

create or replace function public.wallet_debit(p_user_id uuid, p_amount numeric, p_idempotency_key text, p_reference_id text default null, p_description text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_balance numeric(12,2); v_new numeric(12,2);
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'idempotency key required'; end if;
  if exists (select 1 from public.customer_wallet_ledger where idempotency_key = p_idempotency_key) then
    select balance into v_balance from public.customer_wallets where user_id = p_user_id; return coalesce(v_balance,0);
  end if;
  insert into public.customer_wallets(user_id,balance) values(p_user_id,0) on conflict(user_id) do nothing;
  select balance into v_balance from public.customer_wallets where user_id=p_user_id for update;
  if v_balance < round(p_amount,2) then raise exception 'insufficient wallet balance'; end if;
  v_new := v_balance - round(p_amount,2);
  update public.customer_wallets set balance=v_new, updated_at=now() where user_id=p_user_id;
  insert into public.customer_wallet_ledger(user_id,entry_type,amount,balance_after,reference_id,idempotency_key,description) values(p_user_id,'purchase',round(p_amount,2),v_new,p_reference_id,p_idempotency_key,p_description);
  return v_new;
end; $$;

revoke all on function public.wallet_credit_topup(uuid,numeric,text,text,text) from public, anon, authenticated;
revoke all on function public.wallet_debit(uuid,numeric,text,text,text) from public, anon, authenticated;
grant execute on function public.wallet_credit_topup(uuid,numeric,text,text,text) to service_role;
grant execute on function public.wallet_debit(uuid,numeric,text,text,text) to service_role;
