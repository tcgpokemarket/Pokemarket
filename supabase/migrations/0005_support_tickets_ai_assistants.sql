create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  seller_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  category text not null,
  priority text not null default 'normal',
  status text not null default 'open',
  assigned_ai_agent text,
  assigned_human_agent uuid references auth.users(id) on delete set null,
  issue_summary text not null,
  conversation_history jsonb not null default '[]'::jsonb,
  resolution_notes text,
  escalated_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_name text not null,
  source_url text,
  content_summary text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ai_responses (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  assistant_role text not null,
  response_text text not null,
  policy_notes text,
  needs_human boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_user_id on public.support_tickets (user_id, created_at desc);
create index if not exists idx_support_tickets_status on public.support_tickets (status, priority, created_at desc);
create index if not exists idx_support_tickets_conversation_id on public.support_tickets (conversation_id);
create index if not exists idx_support_ai_responses_ticket_id on public.support_ai_responses (ticket_id, created_at desc);
create index if not exists idx_support_ticket_events_ticket_id on public.support_ticket_events (ticket_id, created_at desc);

alter table public.support_tickets enable row level security;
alter table public.support_knowledge_sources enable row level security;
alter table public.support_ai_responses enable row level security;
alter table public.support_ticket_events enable row level security;

create policy "support tickets readable by owner or admin" on public.support_tickets
  for select using (auth.uid() = user_id or exists (select 1 from public.profiles where id = auth.uid() and is_seller = true));
create policy "support tickets insertable by authenticated users" on public.support_tickets
  for insert with check (auth.uid() = user_id);
create policy "support tickets updatable by owner or admin" on public.support_tickets
  for update using (auth.uid() = user_id or exists (select 1 from public.profiles where id = auth.uid() and is_seller = true));

create policy "support knowledge readable by authenticated users" on public.support_knowledge_sources
  for select using (auth.uid() is not null);
create policy "support knowledge writable by admin" on public.support_knowledge_sources
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_seller = true)) with check (exists (select 1 from public.profiles where id = auth.uid() and is_seller = true));

create policy "support responses readable by owner or admin" on public.support_ai_responses
  for select using (auth.uid() is not null);
create policy "support responses writable by admin" on public.support_ai_responses
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_seller = true)) with check (exists (select 1 from public.profiles where id = auth.uid() and is_seller = true));

create policy "support ticket events readable by owner or admin" on public.support_ticket_events
  for select using (auth.uid() is not null);
create policy "support ticket events writable by admin" on public.support_ticket_events
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_seller = true)) with check (exists (select 1 from public.profiles where id = auth.uid() and is_seller = true));
