-- A post can have up to 5 photos, each tagged with at most one dish. The cover is recorded by a trigger,
-- extras are added only by the post's author, and published photos cannot be changed or removed.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Fixtures, created as the table owner. Dishes 1 and 2 are served at Rand, dish 3 at Commons.
insert into auth.users(id, email, email_confirmed_at) values
('95000000-0000-4000-8000-000000000001', 'photos-a@vanderbilt.edu', now()),
('95000000-0000-4000-8000-000000000002', 'photos-b@vanderbilt.edu', now());
insert into public.profiles(id, display_name) values
('95000000-0000-4000-8000-000000000001', 'Photos A'),
('95000000-0000-4000-8000-000000000002', 'Photos B');
insert into public.menu_items(id, dining_hall_id, name) values
('95000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000001', 'Photo Dish 1'),
('95000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-000000000001', 'Photo Dish 2'),
('95000000-0000-4000-8000-0000000000a3', '10000000-0000-4000-8000-000000000002', 'Photo Dish 3');
-- The cover is b0 (the post's id); b1-b5 are extra photos. b6 is never uploaded; b7 belongs to member B.
-- b8 and b9 are covers of two more posts.
insert into storage.objects (bucket_id, name, owner_id)
select 'food-photos', '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b' || n || '.jpg', '95000000-0000-4000-8000-000000000001'
from generate_series(0, 5) as n;
insert into storage.objects (bucket_id, name, owner_id) values
('food-photos', '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b8.jpg', '95000000-0000-4000-8000-000000000001'),
('food-photos', '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b9.jpg', '95000000-0000-4000-8000-000000000001');
insert into storage.objects (bucket_id, name, owner_id) values
('food-photos', '95000000-0000-4000-8000-000000000002/95000000-0000-4000-8000-0000000000b7.jpg', '95000000-0000-4000-8000-000000000002');

-- Member A publishes a post whose cover shows dish 1.
set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000001', true);

select lives_ok($$insert into public.posts (id, author_id, dining_hall_id, photo_path, menu_item_id) values
  ('95000000-0000-4000-8000-0000000000b0', '95000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b0.jpg', '95000000-0000-4000-8000-0000000000a1')$$,
  'A post with a cover photo and dish can be published');
select is((select count(*) from public.post_photos where post_id = '95000000-0000-4000-8000-0000000000b0'), 1::bigint,
  'Publishing a post records its cover photo');
select is((select menu_item_id from public.post_photos where id = '95000000-0000-4000-8000-0000000000b0' and slot = 0),
  '95000000-0000-4000-8000-0000000000a1'::uuid, 'The cover photo carries the post''s dish');

select lives_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_id) values
  ('95000000-0000-4000-8000-0000000000b1', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 1,
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b1.jpg', '95000000-0000-4000-8000-0000000000a2')$$,
  'The author can add a second photo tagged with another dish');
select lives_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path) values
  ('95000000-0000-4000-8000-0000000000b2', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 2,
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b2.jpg')$$,
  'A photo does not need a dish tag');
select throws_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_id) values
  ('95000000-0000-4000-8000-0000000000b3', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 3,
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b3.jpg', '95000000-0000-4000-8000-0000000000a3')$$,
  '23503', null, 'A photo cannot be tagged with a dish from a different dining hall');
select throws_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_id) values
  ('95000000-0000-4000-8000-0000000000b3', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 3,
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b3.jpg', '95000000-0000-4000-8000-0000000000a1')$$,
  '23505', null, 'The same dish cannot be tagged on two photos of one post');
select throws_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path) values
  ('95000000-0000-4000-8000-0000000000b4', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 5,
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b4.jpg')$$,
  '23514', null, 'A post cannot have a sixth photo');
select throws_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path) values
  ('95000000-0000-4000-8000-0000000000b5', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 0,
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b5.jpg')$$,
  '42501', null, 'Clients cannot write the cover photo; it comes from the post');
select throws_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path) values
  ('95000000-0000-4000-8000-0000000000b6', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 3,
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b6.jpg')$$,
  '42501', null, 'A photo must have been uploaded first');
select throws_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path) values
  ('95000000-0000-4000-8000-0000000000b4', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 3,
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b5.jpg')$$,
  '42501', null, 'The photo path must match the photo id');
select throws_ok($$update public.post_photos set menu_item_id = null where id = '95000000-0000-4000-8000-0000000000b1'$$,
  '42501', 'permission denied for table post_photos', 'A published photo''s dish cannot be changed');
select throws_ok($$delete from public.post_photos where id = '95000000-0000-4000-8000-0000000000b1'$$,
  '42501', 'permission denied for table post_photos', 'A published photo cannot be removed');

-- Free-text labels, for dishes that are not on the menu.
select lives_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, dish_text) values
  ('95000000-0000-4000-8000-0000000000b3', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 3,
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b3.jpg', 'Grandma''s soup')$$,
  'A photo can be labeled with free text');
select throws_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, dish_text) values
  ('95000000-0000-4000-8000-0000000000b4', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 4,
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b4.jpg', '   ')$$,
  '23514', null, 'A blank label is rejected');
select throws_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, dish_text) values
  ('95000000-0000-4000-8000-0000000000b4', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 4,
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b4.jpg', repeat('x', 101))$$,
  '23514', null, 'A label over 100 characters is rejected');
select lives_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, dish_text) values
  ('95000000-0000-4000-8000-0000000000b4', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 4,
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b4.jpg', repeat('x', 100))$$,
  'A label of exactly 100 characters is accepted');
select throws_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_id, dish_text) values
  ('95000000-0000-4000-8000-0000000000b5', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 4,
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b5.jpg', '95000000-0000-4000-8000-0000000000a2', 'Both')$$,
  '23514', null, 'A photo cannot name a menu dish and free text at once');
select lives_ok($$insert into public.posts (id, author_id, dining_hall_id, photo_path, dish_text) values
  ('95000000-0000-4000-8000-0000000000b8', '95000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b8.jpg', 'Chef''s special')$$,
  'A post can be published with a free-text cover label');
select is((select dish_text from public.post_photos where id = '95000000-0000-4000-8000-0000000000b8' and slot = 0),
  'Chef''s special', 'The cover photo carries the post''s free-text label');
select throws_ok($$insert into public.posts (id, author_id, dining_hall_id, photo_path, menu_item_id, dish_text) values
  ('95000000-0000-4000-8000-0000000000b9', '95000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '95000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-0000000000b9.jpg', '95000000-0000-4000-8000-0000000000a1', 'Both')$$,
  '23514', null, 'A post cannot name a menu dish and free text at once');

-- Member B reads the photos but cannot add to A's post.
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.post_photos where post_id = '95000000-0000-4000-8000-0000000000b0'), 5::bigint,
  'Members can read all the photos of a post');
select throws_ok($$insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path) values
  ('95000000-0000-4000-8000-0000000000b7', '95000000-0000-4000-8000-0000000000b0', '10000000-0000-4000-8000-000000000001', 3,
   '95000000-0000-4000-8000-000000000002/95000000-0000-4000-8000-0000000000b7.jpg')$$,
  '42501', null, 'A member cannot add photos to someone else''s post');

-- Signed out
set local role anon;
select throws_ok($$select id from public.post_photos$$,
  '42501', 'permission denied for table post_photos', 'Signed-out users cannot read photos');

select * from finish();
rollback;
