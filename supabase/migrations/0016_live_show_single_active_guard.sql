create unique index if not exists live_shows_one_active_per_seller
  on public.live_shows (seller_id)
  where status = 'live';

create or replace function public.prevent_multiple_live_shows_per_seller()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'live' then
    if exists (
      select 1
      from public.live_shows ls
      where ls.seller_id = new.seller_id
        and ls.status = 'live'
        and ls.id <> coalesce(new.id, gen_random_uuid())
    ) then
      raise exception 'seller already has a live auction';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_multiple_live_shows_per_seller on public.live_shows;
create trigger trg_prevent_multiple_live_shows_per_seller
before insert or update on public.live_shows
for each row
execute function public.prevent_multiple_live_shows_per_seller();

alter table public.live_shows enable row level security;
