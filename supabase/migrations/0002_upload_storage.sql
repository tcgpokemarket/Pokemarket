-- Upload storage buckets and policies
insert into storage.buckets (id, name, public)
values
  ('listing-images', 'listing-images', true),
  ('seller-assets', 'seller-assets', true),
  ('profile-assets', 'profile-assets', true),
  ('live-show-media', 'live-show-media', true),
  ('category-assets', 'category-assets', true),
  ('community-assets', 'community-assets', true),
  ('giveaway-assets', 'giveaway-assets', true),
  ('admin-assets', 'admin-assets', true),
  ('help-assets', 'help-assets', true),
  ('email-assets', 'email-assets', true)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

create policy if not exists "listing_images_select" on storage.objects
  for select using (bucket_id = 'listing-images');

create policy if not exists "listing_images_insert" on storage.objects
  for insert with check (
    bucket_id = 'listing-images'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy if not exists "listing_images_delete" on storage.objects
  for delete using (bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[2]);

create policy if not exists "seller_assets_select" on storage.objects
  for select using (bucket_id = 'seller-assets');

create policy if not exists "seller_assets_insert" on storage.objects
  for insert with check (
    bucket_id = 'seller-assets'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy if not exists "seller_assets_delete" on storage.objects
  for delete using (bucket_id = 'seller-assets' and auth.uid()::text = (storage.foldername(name))[2]);

create policy if not exists "profile_assets_select" on storage.objects
  for select using (bucket_id = 'profile-assets');

create policy if not exists "profile_assets_insert" on storage.objects
  for insert with check (
    bucket_id = 'profile-assets'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy if not exists "profile_assets_delete" on storage.objects
  for delete using (bucket_id = 'profile-assets' and auth.uid()::text = (storage.foldername(name))[2]);

create policy if not exists "live_show_media_select" on storage.objects
  for select using (bucket_id = 'live-show-media');

create policy if not exists "live_show_media_insert" on storage.objects
  for insert with check (
    bucket_id = 'live-show-media'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy if not exists "live_show_media_delete" on storage.objects
  for delete using (bucket_id = 'live-show-media' and auth.uid()::text = (storage.foldername(name))[2]);

create policy if not exists "category_assets_select" on storage.objects
  for select using (bucket_id = 'category-assets');

create policy if not exists "category_assets_insert" on storage.objects
  for insert with check (
    bucket_id = 'category-assets'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy if not exists "category_assets_delete" on storage.objects
  for delete using (bucket_id = 'category-assets' and auth.uid()::text = (storage.foldername(name))[2]);

create policy if not exists "community_assets_select" on storage.objects
  for select using (bucket_id = 'community-assets');

create policy if not exists "community_assets_insert" on storage.objects
  for insert with check (
    bucket_id = 'community-assets'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy if not exists "community_assets_delete" on storage.objects
  for delete using (bucket_id = 'community-assets' and auth.uid()::text = (storage.foldername(name))[2]);

create policy if not exists "giveaway_assets_select" on storage.objects
  for select using (bucket_id = 'giveaway-assets');

create policy if not exists "giveaway_assets_insert" on storage.objects
  for insert with check (
    bucket_id = 'giveaway-assets'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy if not exists "giveaway_assets_delete" on storage.objects
  for delete using (bucket_id = 'giveaway-assets' and auth.uid()::text = (storage.foldername(name))[2]);

create policy if not exists "admin_assets_select" on storage.objects
  for select using (bucket_id = 'admin-assets');

create policy if not exists "admin_assets_insert" on storage.objects
  for insert with check (
    bucket_id = 'admin-assets'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy if not exists "admin_assets_delete" on storage.objects
  for delete using (bucket_id = 'admin-assets' and auth.uid()::text = (storage.foldername(name))[2]);

create policy if not exists "help_assets_select" on storage.objects
  for select using (bucket_id = 'help-assets');

create policy if not exists "help_assets_insert" on storage.objects
  for insert with check (
    bucket_id = 'help-assets'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy if not exists "help_assets_delete" on storage.objects
  for delete using (bucket_id = 'help-assets' and auth.uid()::text = (storage.foldername(name))[2]);

create policy if not exists "email_assets_select" on storage.objects
  for select using (bucket_id = 'email-assets');

create policy if not exists "email_assets_insert" on storage.objects
  for insert with check (
    bucket_id = 'email-assets'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy if not exists "email_assets_delete" on storage.objects
  for delete using (bucket_id = 'email-assets' and auth.uid()::text = (storage.foldername(name))[2]);

