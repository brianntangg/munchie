-- Each photo keeps the score its author gave a menu dish when posting, so re-rating the dish later does not change
-- the stars on older posts (review of #56). Members can write the score only when publishing, never afterwards.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Fixtures, created as the table owner. Both dishes are served at Rand.
insert into auth.users(id, email, email_confirmed_at) values
('96000000-0000-4000-8000-000000000001', 'score-a@vanderbilt.edu', now());
insert into public.profiles(id, display_name) values ('96000000-0000-4000-8000-000000000001', 'Score A');
insert into public.menu_items(id, dining_hall_id, name) values
('96000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000001', 'Score Dish 1'),
('96000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-000000000001', 'Score Dish 2');

select throws_ok($$insert into public.posts (id, author_id, dining_hall_id, photo_path, menu_item_score) values
  ('96000000-0000-4000-8000-0000000000b0', '96000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '96000000-0000-4000-8000-000000000001/96000000-0000-4000-8000-0000000000b0.jpg', 4)$$,
  '23514', null, 'A post without a menu dish cannot carry a dish score');
select throws_ok($$insert into public.posts (id, author_id, dining_hall_id, photo_path, menu_item_id, menu_item_score) values
  ('96000000-0000-4000-8000-0000000000b0', '96000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '96000000-0000-4000-8000-000000000001/96000000-0000-4000-8000-0000000000b0.jpg', '96000000-0000-4000-8000-0000000000a1', 6)$$,
  '23514', null, 'A dish score above 5 is rejected');

-- Monday: dish 1 at 5 stars. Friday: the same dish at 2 stars, and the member's rating changes to 2.
insert into public.posts (id, author_id, dining_hall_id, photo_path, menu_item_id, menu_item_score) values
('96000000-0000-4000-8000-0000000000b1', '96000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
 '96000000-0000-4000-8000-000000000001/96000000-0000-4000-8000-0000000000b1.jpg', '96000000-0000-4000-8000-0000000000a1', 5);
insert into public.ratings (author_id, menu_item_id, score) values
('96000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-0000000000a1', 5);
insert into public.posts (id, author_id, dining_hall_id, photo_path, menu_item_id, menu_item_score) values
('96000000-0000-4000-8000-0000000000b2', '96000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
 '96000000-0000-4000-8000-000000000001/96000000-0000-4000-8000-0000000000b2.jpg', '96000000-0000-4000-8000-0000000000a1', 2);
update public.ratings set score = 2
where author_id = '96000000-0000-4000-8000-000000000001' and menu_item_id = '96000000-0000-4000-8000-0000000000a1';

select is((select menu_item_score from public.post_photos where id = '96000000-0000-4000-8000-0000000000b1' and slot = 0),
  5::smallint, 'The cover photo copies the post''s dish score, and re-rating the dish later does not change it');
select is((select menu_item_score from public.post_photos where id = '96000000-0000-4000-8000-0000000000b2' and slot = 0),
  2::smallint, 'A second post of the same dish keeps its own score');

select throws_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_score) values
  ('96000000-0000-4000-8000-0000000000c1', '96000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001', 1,
   '96000000-0000-4000-8000-000000000001/96000000-0000-4000-8000-0000000000c1.jpg', 3)$$,
  '23514', null, 'An extra photo without a menu dish cannot carry a dish score');
select lives_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_id, menu_item_score) values
  ('96000000-0000-4000-8000-0000000000c1', '96000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001', 1,
   '96000000-0000-4000-8000-000000000001/96000000-0000-4000-8000-0000000000c1.jpg', '96000000-0000-4000-8000-0000000000a2', 3)$$,
  'An extra photo of a menu dish can carry its score');

-- Members can send the score with a new post or photo, but can never change it afterwards.
select ok(has_column_privilege('authenticated', 'public.posts', 'menu_item_score', 'INSERT')
  and has_column_privilege('authenticated', 'public.post_photos', 'menu_item_score', 'INSERT'),
  'Members can save a dish score when publishing');
select ok(not has_column_privilege('authenticated', 'public.posts', 'menu_item_score', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.post_photos', 'menu_item_score', 'UPDATE'),
  'Members cannot change a published dish score');
select ok(not has_column_privilege('anon', 'public.post_photos', 'menu_item_score', 'SELECT'),
  'Signed-out visitors cannot read dish scores');

select * from finish();
rollback;
