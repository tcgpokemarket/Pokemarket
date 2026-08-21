-- Admin/dashboard scale hardening.
-- Applied to the connected Supabase project as part of the admin integration audit.

create index if not exists rip_jurisdiction_rules_pack_id_idx on public.rip_jurisdiction_rules (pack_id);
create index if not exists rip_pack_versions_created_by_idx on public.rip_pack_versions (created_by);
create index if not exists rip_packs_active_version_idx on public.rip_packs (active_version_id);
create index if not exists rip_packs_created_by_idx on public.rip_packs (created_by);
create index if not exists rip_pricing_snapshots_rip_result_id_idx on public.rip_pricing_snapshots (rip_result_id);

alter policy live_show_messages_admin_all on public.live_show_messages using ((exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)));
alter policy live_show_messages_admin_all on public.live_show_messages with check ((exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)));
alter policy live_show_messages_sender_read on public.live_show_messages using ((sender_id = (select auth.uid())));
alter policy live_show_messages_sender_insert on public.live_show_messages with check ((sender_id = (select auth.uid())));
alter policy live_show_bids_admin_all on public.live_show_bids using ((exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)));
alter policy live_show_bids_admin_all on public.live_show_bids with check ((exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin = true)));
alter policy live_show_bids_seller_read_on_own_show on public.live_show_bids using ((exists (select 1 from public.live_shows s where s.id = live_show_bids.show_id and s.seller_id = (select auth.uid()))));
alter policy live_show_bids_bidder_read on public.live_show_bids using ((bidder_id = (select auth.uid())));
alter policy live_show_bids_bidder_insert on public.live_show_bids with check ((bidder_id = (select auth.uid())));
alter policy packs_admin_all on public.rip_packs using ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = any (array['admin'::text,'super_admin'::text]));
alter policy pack_versions_admin_all on public.rip_pack_versions using ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = any (array['admin'::text,'super_admin'::text]));
alter policy physical_inventory_admin on public.rip_physical_inventory using ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = any (array['admin'::text,'super_admin'::text]));
alter policy transactions_own on public.rip_transactions using ((user_id = (select auth.uid())));
alter policy results_own on public.rip_results using ((user_id = (select auth.uid())));
alter policy digital_inventory_own on public.digital_inventory using ((user_id = (select auth.uid())));
alter policy pricing_snapshots_auth_read on public.rip_pricing_snapshots using ((select auth.role()) = 'authenticated'::text);
alter policy jurisdiction_rules_read on public.rip_jurisdiction_rules using ((select auth.role()) = 'authenticated'::text);
alter policy audit_logs_admin on public.rip_audit_logs using ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = any (array['admin'::text,'super_admin'::text]));

-- allocate_rip_card is invoked by the authenticated server-side reveal route
-- with the Supabase service-role client. Do not expose this privileged RPC to
-- browser roles.
revoke execute on function public.allocate_rip_card(uuid, uuid, uuid, uuid) from anon, authenticated;
grant execute on function public.allocate_rip_card(uuid, uuid, uuid, uuid) to service_role;

-- Auth leaked-password protection is a Supabase Auth project setting and is
-- intentionally not changed by SQL migrations.