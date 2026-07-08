create table if not exists public.auction_orders (
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

create table if not exists public.payment_events (
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
