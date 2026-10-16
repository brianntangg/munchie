-- Sprint 3: dishes served at each dining hall. Ratings point at these rows.
-- The NetNutrition importer (Story 15) loads them outside the app; app clients only read.
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  dining_hall_id uuid not null references public.dining_halls(id),
  name text not null check (char_length(trim(name)) between 1 and 200),
  category text check (category is null or char_length(trim(category)) between 1 and 100),
  -- Also serves as the index for listing a hall's dishes.
  constraint menu_items_one_per_hall unique (dining_hall_id, name)
);

alter table public.menu_items enable row level security;
revoke all on public.menu_items from anon, authenticated;
grant select on public.menu_items to authenticated;
create policy members_read_menu_items on public.menu_items for select to authenticated using ((select private.is_member()));
