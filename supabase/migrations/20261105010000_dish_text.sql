-- A photo can be labeled with free text when its dish is not on the hall's menu. A photo names a menu dish or
-- free text, never both. Menu dishes are rated in `ratings`, which feeds each dish's average; free text has no
-- menu item to rate, so its optional 1-5 score is stored on the photo itself and never counts toward an average.
alter table public.posts add column dish_text text check (dish_text is null or char_length(trim(dish_text)) between 1 and 100);
alter table public.posts add constraint posts_one_dish_kind check (menu_item_id is null or dish_text is null);
alter table public.posts add column dish_text_score smallint check (dish_text_score between 1 and 5);
alter table public.posts add constraint posts_score_needs_text check (dish_text_score is null or dish_text is not null);
grant insert (dish_text, dish_text_score) on public.posts to authenticated;

alter table public.post_photos add column dish_text text check (dish_text is null or char_length(trim(dish_text)) between 1 and 100);
alter table public.post_photos add constraint post_photos_one_dish_kind check (menu_item_id is null or dish_text is null);
alter table public.post_photos add column dish_text_score smallint check (dish_text_score between 1 and 5);
alter table public.post_photos add constraint post_photos_score_needs_text check (dish_text_score is null or dish_text is not null);
grant insert (dish_text, dish_text_score) on public.post_photos to authenticated;

-- The cover row copies the post's label, and its score, along with its dish.
create or replace function private.add_cover_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_id, dish_text, dish_text_score)
  values (new.id, new.id, new.dining_hall_id, 0, new.photo_path, new.menu_item_id, new.dish_text, new.dish_text_score);
  return new;
end;
$$;
