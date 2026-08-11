alter table public.rip_physical_inventory
  add column if not exists notes text;
