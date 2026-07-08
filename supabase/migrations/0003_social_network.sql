create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, receiver_id),
  check (requester_id <> receiver_id)
);

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  related_user uuid references auth.users(id) on delete set null,
  related_content jsonb,
  read_status boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  who_can_follow text not null default 'everyone' check (who_can_follow in ('everyone', 'followers_only', 'no_one')),
  who_can_friend_request text not null default 'everyone' check (who_can_friend_request in ('everyone', 'followers_only', 'no_one')),
  profile_visibility text not null default 'public' check (profile_visibility in ('public', 'followers_only', 'friends_only', 'private')),
  collection_visibility text not null default 'public' check (collection_visibility in ('public', 'followers_only', 'friends_only', 'private')),
  activity_visibility text not null default 'public' check (activity_visibility in ('public', 'followers_only', 'friends_only', 'private')),
  message_visibility text not null default 'followers_only' check (message_visibility in ('everyone', 'followers_only', 'friends_only', 'no_one')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_follows_follower_id on public.follows (follower_id, created_at desc);
create index if not exists idx_follows_following_id on public.follows (following_id, created_at desc);
create index if not exists idx_friendships_requester_id on public.friendships (requester_id, created_at desc);
create index if not exists idx_friendships_receiver_id on public.friendships (receiver_id, created_at desc);
create index if not exists idx_friendships_status on public.friendships (status, created_at desc);
create index if not exists idx_blocks_blocker_id on public.blocks (blocker_id, created_at desc);
create index if not exists idx_blocks_blocked_id on public.blocks (blocked_id, created_at desc);
create index if not exists idx_notifications_user_id on public.notifications (user_id, read_status, created_at desc);

alter table public.follows enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.notifications enable row level security;
alter table public.profile_privacy_settings enable row level security;

create policy "follows are readable by participants" on public.follows
  for select using (auth.uid() = follower_id or auth.uid() = following_id);

create policy "follows are insertable by follower" on public.follows
  for insert with check (auth.uid() = follower_id);

create policy "follows are deletable by follower" on public.follows
  for delete using (auth.uid() = follower_id);

create policy "friendships are readable by participants" on public.friendships
  for select using (auth.uid() = requester_id or auth.uid() = receiver_id);

create policy "friendships are insertable by requester" on public.friendships
  for insert with check (auth.uid() = requester_id);

create policy "friendships are updatable by participants" on public.friendships
  for update using (auth.uid() = requester_id or auth.uid() = receiver_id);

create policy "friendships are deletable by participants" on public.friendships
  for delete using (auth.uid() = requester_id or auth.uid() = receiver_id);

create policy "blocks are readable by blocker" on public.blocks
  for select using (auth.uid() = blocker_id or auth.uid() = blocked_id);

create policy "blocks are insertable by blocker" on public.blocks
  for insert with check (auth.uid() = blocker_id);

create policy "blocks are deletable by blocker" on public.blocks
  for delete using (auth.uid() = blocker_id);

create policy "notifications are readable by owner" on public.notifications
  for select using (auth.uid() = user_id);

create policy "notifications are insertable by staff" on public.notifications
  for insert with check (auth.uid() is not null);

create policy "notifications are updatable by owner" on public.notifications
  for update using (auth.uid() = user_id);

create policy "privacy settings are readable by owner" on public.profile_privacy_settings
  for select using (auth.uid() = user_id);

create policy "privacy settings are insertable by owner" on public.profile_privacy_settings
  for insert with check (auth.uid() = user_id);

create policy "privacy settings are updatable by owner" on public.profile_privacy_settings
  for update using (auth.uid() = user_id);
