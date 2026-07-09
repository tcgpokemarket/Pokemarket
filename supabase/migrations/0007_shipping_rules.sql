create table if not exists public.shipping_rules (
  id uuid primary key default gen_random_uuid(),
  weight_min numeric(10,2) not null,
  weight_max numeric(10,2),
  package_type text not null,
  usps_service text not null,
  shipping_price numeric(10,2) not null default 0,
  tracking_required boolean not null default true,
  active_status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shipping_rules enable row level security;

create policy "shipping rules readable by authenticated users" on public.shipping_rules
  for select using (auth.uid() is not null);

create policy "shipping rules editable by staff" on public.shipping_rules
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
