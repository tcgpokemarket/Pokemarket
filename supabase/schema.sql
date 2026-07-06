create extension if not exists "uuid-ossp";

create table if not exists profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null,
 display_name text,
 created_at timestamptz default now()
);

create table if not exists leads (
 id uuid primary key default uuid_generate_v4(),
 email text not null,
 status text default 'new',
 created_at timestamptz default now()
);

create table if not exists listings (
 id uuid primary key default uuid_generate_v4(),
 seller_id uuid references profiles(id) on delete cascade,
 title text not null,
 description text,
 price numeric not null,
 image_url text,
 created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table listings enable row level security;

create policy "public profiles" on profiles for select using (true);
create policy "public listings" on listings for select using (true);