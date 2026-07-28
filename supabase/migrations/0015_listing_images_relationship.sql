create table if not exists public.listing_images (
  id uuid default gen_random_uuid() primary key,
  listing_id uuid references public.listings(id) on delete cascade not null,
  bucket text not null default 'listing-images',
  storage_path text not null,
  public_url text not null,
  sort_order integer not null default 0,
  source text not null default 'listing_upload',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (listing_id, storage_path)
);

create index if not exists listing_images_listing_idx on public.listing_images(listing_id, sort_order);
create index if not exists listing_images_public_url_idx on public.listing_images(public_url);

alter table public.listing_images enable row level security;

do $$ begin
  create policy "listing_images_select_public" on public.listing_images
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "listing_images_insert_owner" on public.listing_images
    for insert with check (
      exists (
        select 1
        from public.listings l
        where l.id = listing_id and l.seller_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "listing_images_update_owner" on public.listing_images
    for update using (
      exists (
        select 1
        from public.listings l
        where l.id = listing_id and l.seller_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "listing_images_delete_owner" on public.listing_images
    for delete using (
      exists (
        select 1
        from public.listings l
        where l.id = listing_id and l.seller_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

create or replace function public.sync_listing_images()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    update public.listings
      set images = coalesce((
        select array_agg(li.public_url order by li.sort_order, li.created_at)
        from public.listing_images li
        where li.listing_id = old.listing_id
      ), '{}'::text[]),
          updated_at = now()
      where id = old.listing_id;
    return old;
  end if;

  update public.listings
    set images = coalesce((
      select array_agg(li.public_url order by li.sort_order, li.created_at)
      from public.listing_images li
      where li.listing_id = new.listing_id
    ), '{}'::text[]),
        updated_at = now()
    where id = new.listing_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists listing_images_sync on public.listing_images;
create trigger listing_images_sync
  after insert or update or delete on public.listing_images
  for each row execute procedure public.sync_listing_images();

insert into public.listing_images (listing_id, bucket, storage_path, public_url, sort_order, source)
select
  l.id,
  coalesce(split_part(split_part(l.images[1], '/storage/v1/object/public/', 2), '/', 1), 'listing-images'),
  coalesce(nullif(split_part(split_part(l.images[1], '/storage/v1/object/public/', 2), '/', 2), ''), l.images[1]),
  l.images[1],
  0,
  'backfill'
from public.listings l
where array_length(l.images, 1) = 1
  and position('/storage/v1/object/public/' in l.images[1]) > 0
  and not exists (
    select 1
    from public.listing_images li
    where li.listing_id = l.id
  )
on conflict do nothing;

insert into public.listing_images (listing_id, bucket, storage_path, public_url, sort_order, source)
select
  l.id,
  'listing-images',
  l.images[1],
  l.images[1],
  0,
  'backfill'
from public.listings l
where array_length(l.images, 1) = 1
  and position('/storage/v1/object/public/' in l.images[1]) = 0
  and not exists (
    select 1
    from public.listing_images li
    where li.listing_id = l.id
  )
on conflict do nothing;

update public.listings
set images = coalesce((
  select array_agg(li.public_url order by li.sort_order, li.created_at)
  from public.listing_images li
  where li.listing_id = listings.id
), '{}'::text[]),
    updated_at = now()
where exists (
  select 1 from public.listing_images li where li.listing_id = listings.id
);