-- Comment flooding: a member can post at most 10 comments in any minute. Other members are not affected, and the
-- member can comment again once their earlier comments are more than a minute old.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Fixtures, created as the table owner.
insert into auth.users(id, email, email_confirmed_at) values
('97000000-0000-4000-8000-000000000001', 'flood-a@vanderbilt.edu', now()),
('97000000-0000-4000-8000-000000000002', 'flood-b@vanderbilt.edu', now());
insert into public.profiles(id, display_name) values
('97000000-0000-4000-8000-000000000001', 'Flood A'),
('97000000-0000-4000-8000-000000000002', 'Flood B');
insert into public.posts (id, author_id, dining_hall_id, photo_path) values
('97000000-0000-4000-8000-0000000000c1', '97000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
 '97000000-0000-4000-8000-000000000002/97000000-0000-4000-8000-0000000000c1.jpg');

-- Member A posts 10 comments in a row.
set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000001', true);
select lives_ok($$insert into public.comments (post_id, body)
  select '97000000-0000-4000-8000-0000000000c1', 'comment ' || n from generate_series(1, 10) as n$$,
  'A member can post 10 comments in a minute');
select throws_ok($$insert into public.comments (post_id, body) values ('97000000-0000-4000-8000-0000000000c1', 'one more')$$,
  'PT429', 'You are commenting too fast. Wait a minute, then try again.', 'The 11th comment within a minute is refused');
select is((select count(*) from public.comments where author_id = '97000000-0000-4000-8000-000000000001'), 10::bigint,
  'Only the first 10 comments were saved');

-- Member B is not limited by A's comments.
select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000002', true);
select lives_ok($$insert into public.comments (post_id, body) values ('97000000-0000-4000-8000-0000000000c1', 'my own post')$$,
  'Another member can still comment');

-- Once A's comments are more than a minute old, A can comment again.
reset role;
update public.comments set created_at = now() - interval '61 seconds'
where author_id = '97000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000001', true);
select lives_ok($$insert into public.comments (post_id, body) values ('97000000-0000-4000-8000-0000000000c1', 'back again')$$,
  'A member can comment again a minute later');

-- A bulk insert counts every row, so it cannot slip a batch past the limit.
reset role;
delete from public.comments where author_id = '97000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000001', true);
select throws_ok($$insert into public.comments (post_id, body)
  select '97000000-0000-4000-8000-0000000000c1', 'batch ' || n from generate_series(1, 11) as n$$,
  'PT429', null, 'A single request with 11 comments is refused');

select * from finish();
rollback;
