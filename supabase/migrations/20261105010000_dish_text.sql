-- A photo can be labeled with free text when its dish is not on the hall's menu. A photo names a menu dish or
-- free text, never both; only menu dishes can be rated, so free text carries no score.
alter table public.posts add column dish_text text check (dish_text is null or char_length(trim(dish_text)) between 1 and 100);
alter table public.posts add constraint posts_one_dish_kind check (menu_item_id is null or dish_text is null);
grant insert (dish_text) on public.posts to authenticated;

alter table public.post_photos add column dish_text text check (dish_text is null or char_length(trim(dish_text)) between 1 and 100);
alter table public.post_photos add constraint post_photos_one_dish_kind check (menu_item_id is null or dish_text is null);
grant insert (dish_text) on public.post_photos to authenticated;

-- The cover row copies the post's label along with its dish.
create or replace function private.add_cover_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_id, dish_text)
  values (new.id, new.id, new.dining_hall_id, 0, new.photo_path, new.menu_item_id, new.dish_text);
  return new;
end;
$$;
