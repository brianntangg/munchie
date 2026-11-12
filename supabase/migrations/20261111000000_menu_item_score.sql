-- A photo's menu dish now keeps the score its author gave when posting (review of #56). Until now the feed looked up
-- the author's current rating of the dish, so rating the same dish again rewrote the stars on every older post.
-- `ratings` stays one current score per member and dish, which the dish average needs; this column is a fixed copy
-- for the post, written once and never updated, like `dish_text_score` for typed labels.
alter table public.posts add column menu_item_score smallint check (menu_item_score between 1 and 5);
alter table public.posts add constraint posts_score_needs_dish check (menu_item_score is null or menu_item_id is not null);
grant insert (menu_item_score) on public.posts to authenticated;

alter table public.post_photos add column menu_item_score smallint check (menu_item_score between 1 and 5);
alter table public.post_photos add constraint post_photos_score_needs_dish check (menu_item_score is null or menu_item_id is not null);
grant insert (menu_item_score) on public.post_photos to authenticated;

-- The cover row copies the post's score along with its dish.
create or replace function private.add_cover_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_id, menu_item_score, dish_text, dish_text_score)
  values (new.id, new.id, new.dining_hall_id, 0, new.photo_path, new.menu_item_id, new.menu_item_score, new.dish_text, new.dish_text_score);
  return new;
end;
$$;

-- Existing posts keep the stars they show today: the author's current rating of the dish, the closest record there is
-- of the score they gave.
update public.posts set menu_item_score = ratings.score
from public.ratings
where ratings.author_id = posts.author_id and ratings.menu_item_id = posts.menu_item_id;

update public.post_photos set menu_item_score = ratings.score
from public.posts, public.ratings
where posts.id = post_photos.post_id
  and ratings.author_id = posts.author_id and ratings.menu_item_id = post_photos.menu_item_id;
