-- A post can say which dish it is about. The author's score for that dish stays in public.ratings; the feed looks it up.
-- (id, dining_hall_id) is unique so a post's dish can be required to belong to the post's own dining hall.
alter table public.menu_items add constraint menu_items_id_hall_key unique (id, dining_hall_id);
alter table public.posts add column menu_item_id uuid;
-- With the column null the foreign key is not checked, so posts without a dish are unaffected.
alter table public.posts add constraint posts_menu_item_in_hall_fkey
  foreign key (menu_item_id, dining_hall_id) references public.menu_items (id, dining_hall_id);
grant insert (menu_item_id) on public.posts to authenticated;
