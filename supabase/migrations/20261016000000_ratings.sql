-- Sprint 3: dish ratings (Story 7). A member rates a menu item from 1 to 5.
-- One rating per member per dish; rating again updates the score instead of adding a row.
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  -- No cascade: refreshing menus must not silently delete students' ratings.
  menu_item_id uuid not null references public.menu_items(id),
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ratings_one_per_member unique (author_id, menu_item_id)
);
create index ratings_menu_item on public.ratings (menu_item_id);

-- Clients cannot set timestamps; the server records when a score last changed.
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger ratings_touch_updated_at before update on public.ratings
for each row execute function private.touch_updated_at();

alter table public.ratings enable row level security;
revoke all on public.ratings from anon, authenticated;
grant select on public.ratings to authenticated;
-- The author always comes from the session (column default); clients send only the dish and score.
grant insert (menu_item_id, score), update (score) on public.ratings to authenticated;

create policy members_read_ratings on public.ratings for select to authenticated using ((select private.is_member()));
create policy members_create_ratings on public.ratings for insert to authenticated
with check ((select private.is_member()) and author_id = (select auth.uid()));
create policy members_update_own_ratings on public.ratings for update to authenticated
using ((select private.is_member()) and author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));
