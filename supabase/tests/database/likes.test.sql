-- Likes: one per member per post, members like and unlike only as themselves,
-- and non-members cannot read or like.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Fixtures, created as the table owner.
insert into auth.users(id, email, email_confirmed_at) values
('95000000-0000-4000-8000-000000000001', 'liker-a@vanderbilt.edu', now()),
('95000000-0000-4000-8000-000000000002', 'liker-b@vanderbilt.edu', now()),
('95000000-0000-4000-8000-000000000003', 'liker-pending@vanderbilt.edu', null);
insert into public.profiles(id, display_name) values
('95000000-0000-4000-8000-000000000001', 'Liker A'),
('95000000-0000-4000-8000-000000000002', 'Liker B');
insert into public.posts (id, author_id, dining_hall_id, photo_path) values
('95000000-0000-4000-8000-0000000000b1', '95000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
 '95000000-0000-4000-8000-000000000002/95000000-0000-4000-8000-0000000000b1.jpg'),
('95000000-0000-4000-8000-0000000000b2', '95000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
 '95000000-0000-4000-8000-000000000002/95000000-0000-4000-8000-0000000000b2.jpg');

-- Member A
set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000001', true);

select lives_ok($$insert into public.likes (post_id) values ('95000000-0000-4000-8000-0000000000b1')$$,
  'A member can like a post');
select is((select author_id from public.likes where post_id = '95000000-0000-4000-8000-0000000000b1'),
  '95000000-0000-4000-8000-000000000001'::uuid, 'The liker is taken from the session');
select throws_ok($$insert into public.likes (post_id) values ('95000000-0000-4000-8000-0000000000b1')$$,
  '23505', null, 'A member cannot like a post twice');
select throws_ok($$insert into public.likes (post_id, author_id) values ('95000000-0000-4000-8000-0000000000b2', '95000000-0000-4000-8000-000000000002')$$,
  '42501', 'permission denied for table likes', 'A member cannot like as someone else');
select throws_ok($$insert into public.likes (post_id) values ('95000000-0000-4000-8000-0000000000ff')$$,
  '23503', null, 'A member cannot like a post that does not exist');

-- Member B likes the same post and cannot remove A's like
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000002', true);
insert into public.likes (post_id) values ('95000000-0000-4000-8000-0000000000b1');
select is((select count(*) from public.likes where post_id = '95000000-0000-4000-8000-0000000000b1'), 2::bigint,
  'Members can read every like on a post, so it can be counted');
delete from public.likes where author_id = '95000000-0000-4000-8000-000000000001';
select is((select count(*) from public.likes where post_id = '95000000-0000-4000-8000-0000000000b1'), 2::bigint,
  'A member cannot remove someone else''s like');

-- Member A unlikes
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000001', true);
delete from public.likes where post_id = '95000000-0000-4000-8000-0000000000b1';
select is((select count(*) from public.likes where post_id = '95000000-0000-4000-8000-0000000000b1'), 1::bigint,
  'A member can unlike a post');

-- Unverified account
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000003', true);
select is((select count(*) from public.likes), 0::bigint, 'Unverified accounts cannot read likes');
select throws_ok($$insert into public.likes (post_id) values ('95000000-0000-4000-8000-0000000000b2')$$,
  '42501', 'new row violates row-level security policy for table "likes"', 'Unverified accounts cannot like');

-- Signed out
set local role anon;
select throws_ok($$select post_id from public.likes$$,
  '42501', 'permission denied for table likes', 'Signed-out users cannot read likes');

select * from finish();
rollback;
