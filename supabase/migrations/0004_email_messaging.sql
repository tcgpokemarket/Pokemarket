create table if not exists public.email_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notification_type)
);

create table if not exists public.email_templates (
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

create table if not exists public.email_logs (
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

create table if not exists public.email_queue (
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

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text,
  context_type text,
  context_id uuid,
  is_archived boolean not null default false
);

create table if not exists public.conversation_members (
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

create table if not exists public.messages (
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

create table if not exists public.message_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.message_reports (
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

create table if not exists public.message_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

create table if not exists public.message_access_rules (
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
