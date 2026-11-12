-- A photo of a menu dish keeps the score its author rated it, fixed once set (review of #56). Until now the feed
-- looked up the author's current rating of the dish, so rating the same dish again rewrote the stars on every older post.
-- `ratings` stays one current score per member and dish, which the dish average needs; this column is a fixed copy.
--
-- The score is copied from `ratings` by the database, never sent by the app, so stars appear only for a rating that was
-- actually saved (and counted in the dish's average). Whenever a member saves a rating, every photo of theirs showing that
-- dish that has no score yet takes it: the photos of the post being published, a post rated later from the dish screen,
-- and posts from app builds that never sent a score. A photo that already has a score keeps it, so re-rating a dish does
-- not change older posts.
alter table public.post_photos add column menu_item_score smallint check (menu_item_score between 1 and 5);
alter table public.post_photos add constraint post_photos_score_needs_dish check (menu_item_score is null or menu_item_id is not null);
-- Serves the trigger's lookup of a member's unscored photos of one dish.
create index post_photos_unscored_dish on public.post_photos (menu_item_id) where menu_item_score is null;

-- Members cannot update post_photos, so this runs as the table owner. It only ever copies the member's own saved score
-- onto their own photos.
create function private.copy_rating_to_photos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.post_photos set menu_item_score = new.score
  from public.posts
  where posts.id = post_photos.post_id
    and posts.author_id = new.author_id
    and post_photos.menu_item_id = new.menu_item_id
    and post_photos.menu_item_score is null;
  return null;
end;
$$;
create trigger ratings_copy_to_photos after insert or update of score on public.ratings
for each row execute function private.copy_rating_to_photos();

-- Existing photos take the score they show today: the author's current rating of the dish.
update public.post_photos set menu_item_score = ratings.score
from public.posts, public.ratings
where posts.id = post_photos.post_id
  and ratings.author_id = posts.author_id and ratings.menu_item_id = post_photos.menu_item_id;
