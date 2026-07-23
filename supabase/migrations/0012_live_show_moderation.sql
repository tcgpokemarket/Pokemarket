create table if not exists public.live_show_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.live_shows(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_username text,
  action_type text not null,
  reason text,
  active boolean not null default true,
  moderator_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by uuid references auth.users(id) on delete set null,
  unique (show_id, target_user_id, action_type)
);

create table if not exists public.live_show_moderation_history (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.live_shows(id) on delete cascade,
  action_id uuid references public.live_show_moderation_actions(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_username text,
  action_type text not null,
  event_type text not null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.live_show_moderation_actions enable row level security;
alter table public.live_show_moderation_history enable row level security;

create index if not exists idx_live_show_moderation_actions_show_id on public.live_show_moderation_actions (show_id, active, updated_at desc);
create index if not exists idx_live_show_moderation_actions_target on public.live_show_moderation_actions (target_user_id, action_type, active);
create index if not exists idx_live_show_moderation_history_show_id on public.live_show_moderation_history (show_id, created_at desc);

create policy "moderation actions are readable" on public.live_show_moderation_actions
  for select using (true);

create policy "moderation history is readable" on public.live_show_moderation_history
  for select using (true);

create policy "moderation actions are insertable by staff" on public.live_show_moderation_actions
  for insert with check (auth.uid() is not null);

create policy "moderation history is insertable by staff" on public.live_show_moderation_history
  for insert with check (auth.uid() is not null);

create policy "moderation actions are updatable by staff" on public.live_show_moderation_actions
  for update using (auth.uid() is not null);

create policy "moderation history is updatable by staff" on public.live_show_moderation_history
  for update using (auth.uid() is not null);
