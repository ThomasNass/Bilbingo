create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid not null,
  name text not null
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid not null,
  text text not null,
  age text not null default 'both',
  category_ids uuid[] default '{}'
);

alter table public.categories enable row level security;
alter table public.items enable row level security;

create policy if not exists categories_user_isolation
  on public.categories
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists items_user_isolation
  on public.items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
