-- A photo of a menu dish takes its author's rating of the dish when the rating is saved, and keeps it: re-rating the dish
-- later does not change older posts (review of #56). Only the database writes the score; members cannot set or change it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Fixtures, created as the table owner. Both dishes are served at Rand.
insert into auth.users(id, email, email_confirmed_at) values
('96000000-0000-4000-8000-000000000001', 'score-a@vanderbilt.edu', now()),
('96000000-0000-4000-8000-000000000002', 'score-b@vanderbilt.edu', now());
insert into public.profiles(id, display_name) values
('96000000-0000-4000-8000-000000000001', 'Score A'),
('96000000-0000-4000-8000-000000000002', 'Score B');
insert into public.menu_items(id, dining_hall_id, name) values
('96000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000001', 'Score Dish 1'),
('96000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-000000000001', 'Score Dish 2');

-- Monday: member A posts dish 1. The post is saved before its rating, as the app does.
insert into public.posts (id, author_id, dining_hall_id, photo_path, menu_item_id) values
('96000000-0000-4000-8000-0000000000b1', '96000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
 '96000000-0000-4000-8000-000000000001/96000000-0000-4000-8000-0000000000b1.jpg', '96000000-0000-4000-8000-0000000000a1');
select is((select menu_item_score from public.post_photos where id = '96000000-0000-4000-8000-0000000000b1'),
  null, 'A photo has no score until its rating is saved, so a failed rating leaves no stars');

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000001', true);
insert into public.ratings (menu_item_id, score) values ('96000000-0000-4000-8000-0000000000a1', 5);
select is((select menu_item_score from public.post_photos where id = '96000000-0000-4000-8000-0000000000b1'),
  5::smallint, 'Saving a rating gives the member''s photo of that dish its score');

-- Friday: A posts dish 1 again, with an extra photo of dish 2, and re-rates dish 1 at 2.
reset role;
insert into public.posts (id, author_id, dining_hall_id, photo_path, menu_item_id) values
('96000000-0000-4000-8000-0000000000b2', '96000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
 '96000000-0000-4000-8000-000000000001/96000000-0000-4000-8000-0000000000b2.jpg', '96000000-0000-4000-8000-0000000000a1');
insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_id) values
('96000000-0000-4000-8000-0000000000c1', '96000000-0000-4000-8000-0000000000b2', '10000000-0000-4000-8000-000000000001', 1,
 '96000000-0000-4000-8000-000000000001/96000000-0000-4000-8000-0000000000c1.jpg', '96000000-0000-4000-8000-0000000000a2');
set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000001', true);
update public.ratings set score = 2 where menu_item_id = '96000000-0000-4000-8000-0000000000a1';

select is((select menu_item_score from public.post_photos where id = '96000000-0000-4000-8000-0000000000b2'),
  2::smallint, 'A second post of the same dish takes the new rating');
select is((select menu_item_score from public.post_photos where id = '96000000-0000-4000-8000-0000000000b1'),
  5::smallint, 'Re-rating the dish does not change the older post');

-- Another member's rating never scores A's photos.
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000002', true);
insert into public.ratings (menu_item_id, score) values ('96000000-0000-4000-8000-0000000000a2', 4);
select is((select menu_item_score from public.post_photos where id = '96000000-0000-4000-8000-0000000000c1'),
  null, 'Another member''s rating of the dish does not score the photo');

-- A rates dish 2 later, for example from the dish screen: the extra photo takes it.
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000001', true);
insert into public.ratings (menu_item_id, score) values ('96000000-0000-4000-8000-0000000000a2', 1);
select is((select menu_item_score from public.post_photos where id = '96000000-0000-4000-8000-0000000000c1'),
  1::smallint, 'A rating saved after posting scores an extra photo of that dish');
select is((select menu_item_score from public.post_photos where id = '96000000-0000-4000-8000-0000000000b2'),
  2::smallint, 'A rating of another dish leaves the post''s other photos alone');

-- Members cannot set or change the score themselves.
select throws_ok($$update public.post_photos set menu_item_score = 5 where id = '96000000-0000-4000-8000-0000000000b2'$$,
  '42501', null, 'A member cannot change a photo''s score');
select ok(not has_column_privilege('authenticated', 'public.post_photos', 'menu_item_score', 'INSERT'),
  'A member cannot send a score with a new photo');
reset role;

select throws_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_score) values
  ('96000000-0000-4000-8000-0000000000c2', '96000000-0000-4000-8000-0000000000b2', '10000000-0000-4000-8000-000000000001', 2,
   '96000000-0000-4000-8000-000000000001/96000000-0000-4000-8000-0000000000c2.jpg', 3)$$,
  '23514', null, 'A photo without a menu dish cannot carry a dish score');
select throws_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_id, menu_item_score) values
  ('96000000-0000-4000-8000-0000000000c2', '96000000-0000-4000-8000-0000000000b2', '10000000-0000-4000-8000-000000000001', 2,
   '96000000-0000-4000-8000-000000000001/96000000-0000-4000-8000-0000000000c2.jpg', '96000000-0000-4000-8000-0000000000a1', 6)$$,
  '23514', null, 'A dish score above 5 is rejected');
select ok(not has_column_privilege('anon', 'public.post_photos', 'menu_item_score', 'SELECT'),
  'Signed-out visitors cannot read dish scores');
select ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'posts' and column_name = 'menu_item_score'),
  'The score lives only on post_photos, which the feed reads');

select * from finish();
rollback;
