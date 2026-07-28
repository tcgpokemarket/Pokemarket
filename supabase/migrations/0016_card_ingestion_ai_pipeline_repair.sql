create table if not exists public.card_ingestion_batches (
  id uuid default gen_random_uuid() primary key,
  created_by uuid references public.profiles(id) on delete cascade not null,
  source text not null default 'admin_upload',
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'in_review', 'ready', 'partial', 'published', 'failed')),
  original_file_count integer not null default 0,
  processed_count integer not null default 0,
  draft_count integer not null default 0,
  published_count integer not null default 0,
  duplicate_count integer not null default 0,
  error_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.card_ingestion_items (
  id uuid default gen_random_uuid() primary key,
  batch_id uuid references public.card_ingestion_batches(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  source_image_url text not null,
  source_image_bucket text not null,
  source_image_path text not null,
  source_image_hash text not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'needs_review', 'ready_to_publish', 'published', 'duplicate', 'rejected', 'failed')),
  card_name text,
  set_name text,
  card_number text,
  rarity text,
  language text,
  variant text,
  category text not null default 'single' check (category in ('single', 'sealed', 'graded', 'accessory')),
  ocr_text text,
  title text,
  description text,
  likely_condition text check (likely_condition in ('Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged')),
  condition_confidence integer,
  condition_notes text,
  estimated_price numeric(10,2),
  low_price numeric(10,2),
  high_price numeric(10,2),
  pricing_source text,
  confidence_score integer,
  duplicate_listing_ids uuid[] not null default '{}'::uuid[],
  duplicate_summary text[] not null default '{}'::text[],
  ai_payload jsonb not null default '{}'::jsonb,
  review_notes text,
  published_listing_id uuid references public.listings(id) on delete set null,
  error_message text,
  processed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.card_ingestion_item_images (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references public.card_ingestion_items(id) on delete cascade not null,
  bucket text not null,
  storage_path text not null,
  public_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists card_ingestion_batches_created_by_idx on public.card_ingestion_batches(created_by, created_at desc);
create index if not exists card_ingestion_items_batch_idx on public.card_ingestion_items(batch_id, created_at desc);
create index if not exists card_ingestion_items_status_idx on public.card_ingestion_items(status, created_at desc);
create index if not exists card_ingestion_item_images_item_idx on public.card_ingestion_item_images(item_id, sort_order);

alter table if exists public.card_ingestion_batches enable row level security;
alter table if exists public.card_ingestion_items enable row level security;
alter table if exists public.card_ingestion_item_images enable row level security;

create policy "card_ingestion_batches_select_admin" on public.card_ingestion_batches
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));
create policy "card_ingestion_batches_insert_admin" on public.card_ingestion_batches
  for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));
create policy "card_ingestion_batches_update_admin" on public.card_ingestion_batches
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));
create policy "card_ingestion_batches_delete_admin" on public.card_ingestion_batches
  for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));

create policy "card_ingestion_items_select_admin" on public.card_ingestion_items
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));
create policy "card_ingestion_items_insert_admin" on public.card_ingestion_items
  for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));
create policy "card_ingestion_items_update_admin" on public.card_ingestion_items
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));
create policy "card_ingestion_items_delete_admin" on public.card_ingestion_items
  for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));

create policy "card_ingestion_item_images_select_admin" on public.card_ingestion_item_images
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));
create policy "card_ingestion_item_images_insert_admin" on public.card_ingestion_item_images
  for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));
create policy "card_ingestion_item_images_delete_admin" on public.card_ingestion_item_images
  for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true));

insert into storage.buckets (id, name, public)
values ('card-ingestion-images', 'card-ingestion-images', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'card_ingestion_images_select_admin'
  ) then
    create policy "card_ingestion_images_select_admin" on storage.objects
      for select using (
        bucket_id = 'card-ingestion-images'
        and exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_seller, false) = true)
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'card_ingestion_images_insert_admin'
  ) then
    create policy "card_ingestion_images_insert_admin" on storage.objects
      for insert with check (
        bucket_id = 'card-ingestion-images'
        and auth.role() = 'authenticated'
        and auth.uid()::text = (storage.foldername(name))[2]
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'card_ingestion_images_delete_admin'
  ) then
    create policy "card_ingestion_images_delete_admin" on storage.objects
      for delete using (
        bucket_id = 'card-ingestion-images'
        and auth.uid()::text = (storage.foldername(name))[2]
      );
  end if;
end
$$;

drop trigger if exists card_ingestion_batches_updated_at on public.card_ingestion_batches;
create trigger card_ingestion_batches_updated_at before update on public.card_ingestion_batches
  for each row execute procedure public.handle_updated_at();

drop trigger if exists card_ingestion_items_updated_at on public.card_ingestion_items;
create trigger card_ingestion_items_updated_at before update on public.card_ingestion_items
  for each row execute procedure public.handle_updated_at();
