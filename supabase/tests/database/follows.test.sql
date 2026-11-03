-- Follows: no self-follows or duplicates, members follow and unfollow only as themselves,
-- and non-members cannot read or follow.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Fixtures, created as the table owner.
insert into auth.users(id, email, email_confirmed_at) values
('94000000-0000-4000-8000-000000000001', 'follower-a@vanderbilt.edu', now()),
('94000000-0000-4000-8000-000000000002', 'follower-b@vanderbilt.edu', now()),
('94000000-0000-4000-8000-000000000003', 'follower-c@vanderbilt.edu', now()),
('94000000-0000-4000-8000-000000000004', 'follower-pending@vanderbilt.edu', null);
insert into public.profiles(id, display_name) values
('94000000-0000-4000-8000-000000000001', 'Follower A'),
('94000000-0000-4000-8000-000000000002', 'Follower B'),
('94000000-0000-4000-8000-000000000003', 'Follower C');

-- Member A
set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000001', true);

select lives_ok($$insert into public.follows (followee_id) values ('94000000-0000-4000-8000-000000000002')$$,
  'A member can follow another member');
select is((select follower_id from public.follows where followee_id = '94000000-0000-4000-8000-000000000002'),
  '94000000-0000-4000-8000-000000000001'::uuid, 'The follower is taken from the session');
select throws_ok($$insert into public.follows (followee_id) values ('94000000-0000-4000-8000-000000000002')$$,
  '23505', null, 'A member cannot follow someone twice');
select throws_ok($$insert into public.follows (followee_id) values ('94000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'A member cannot follow themselves');
select throws_ok($$insert into public.follows (follower_id, followee_id) values ('94000000-0000-4000-8000-000000000003', '94000000-0000-4000-8000-000000000002')$$,
  '42501', 'permission denied for table follows', 'A member cannot follow as someone else');
insert into public.follows (followee_id) values ('94000000-0000-4000-8000-000000000003');

-- Member B
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.follows where follower_id = '94000000-0000-4000-8000-000000000001'), 2::bigint,
  'Members can read other members'' follows');
delete from public.follows where follower_id = '94000000-0000-4000-8000-000000000001';
select is((select count(*) from public.follows where follower_id = '94000000-0000-4000-8000-000000000001'), 2::bigint,
  'A member cannot remove someone else''s follow');

-- Member A unfollows
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000001', true);
delete from public.follows where followee_id = '94000000-0000-4000-8000-000000000003';
select is((select count(*) from public.follows where follower_id = '94000000-0000-4000-8000-000000000001'), 1::bigint,
  'A member can unfollow');

-- Unverified account
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000004', true);
select is((select count(*) from public.follows), 0::bigint, 'Unverified accounts cannot read follows');
select throws_ok($$insert into public.follows (followee_id) values ('94000000-0000-4000-8000-000000000002')$$,
  '42501', 'new row violates row-level security policy for table "follows"', 'Unverified accounts cannot follow');

-- Signed out
set local role anon;
select throws_ok($$select follower_id from public.follows$$,
  '42501', 'permission denied for table follows', 'Signed-out users cannot read follows');

select * from finish();
rollback;
