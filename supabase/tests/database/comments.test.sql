-- Comments: up to 280 characters with at least one non-whitespace character, written and deleted only by their author, never edited,
-- and hidden from non-members.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Fixtures, created as the table owner.
insert into auth.users(id, email, email_confirmed_at) values
('95000000-0000-4000-8000-000000000011', 'commenter-a@vanderbilt.edu', now()),
('95000000-0000-4000-8000-000000000012', 'commenter-b@vanderbilt.edu', now()),
('95000000-0000-4000-8000-000000000013', 'commenter-pending@vanderbilt.edu', null);
insert into public.profiles(id, display_name) values
('95000000-0000-4000-8000-000000000011', 'Commenter A'),
('95000000-0000-4000-8000-000000000012', 'Commenter B');
insert into public.posts (id, author_id, dining_hall_id, photo_path) values
('95000000-0000-4000-8000-0000000000c1', '95000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001',
 '95000000-0000-4000-8000-000000000012/95000000-0000-4000-8000-0000000000c1.jpg');

-- Member A
set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000011', true);

select lives_ok($$insert into public.comments (post_id, body) values ('95000000-0000-4000-8000-0000000000c1', 'Looks great')$$,
  'A member can comment on a post');
select is((select author_id from public.comments where body = 'Looks great'),
  '95000000-0000-4000-8000-000000000011'::uuid, 'The commenter is taken from the session');
select lives_ok($$insert into public.comments (post_id, body) values ('95000000-0000-4000-8000-0000000000c1', repeat('x', 280))$$,
  'A 280-character comment is accepted');
select throws_ok($$insert into public.comments (post_id, body) values ('95000000-0000-4000-8000-0000000000c1', repeat('x', 281))$$,
  '23514', null, 'A 281-character comment is rejected');
select throws_ok($$insert into public.comments (post_id, body) values ('95000000-0000-4000-8000-0000000000c1', '   ')$$,
  '23514', null, 'A blank comment is rejected');
select throws_ok($$insert into public.comments (post_id, body) values ('95000000-0000-4000-8000-0000000000c1', E'\n\t \r\n')$$,
  '23514', null, 'A comment of only newlines and tabs is rejected');
select throws_ok($$insert into public.comments (post_id, body) values ('95000000-0000-4000-8000-0000000000c1', 'Hi' || repeat(' ', 300))$$,
  '23514', null, 'Padding with spaces cannot carry a comment past 280 characters');
select throws_ok($$insert into public.comments (post_id, body, author_id) values
  ('95000000-0000-4000-8000-0000000000c1', 'As B', '95000000-0000-4000-8000-000000000012')$$,
  '42501', 'permission denied for table comments', 'A member cannot comment as someone else');
select throws_ok($$insert into public.comments (post_id, body, created_at) values
  ('95000000-0000-4000-8000-0000000000c1', 'Backdated', '2020-01-01')$$,
  '42501', 'permission denied for table comments', 'A member cannot set the comment time');
select throws_ok($$update public.comments set body = 'Edited' where body = 'Looks great'$$,
  '42501', 'permission denied for table comments', 'Comments cannot be edited');

-- Member B
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000012', true);
select is((select count(*) from public.comments where post_id = '95000000-0000-4000-8000-0000000000c1'), 2::bigint,
  'Members can read every comment on a post');
delete from public.comments where body = 'Looks great';
select is((select count(*) from public.comments where body = 'Looks great'), 1::bigint,
  'A member cannot delete someone else''s comment, even on their own post');

-- Member A deletes their own comment
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000011', true);
delete from public.comments where body = 'Looks great';
select is((select count(*) from public.comments where body = 'Looks great'), 0::bigint,
  'A member can delete their own comment');

-- Unverified account
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000013', true);
select is((select count(*) from public.comments), 0::bigint, 'Unverified accounts cannot read comments');
select throws_ok($$insert into public.comments (post_id, body) values ('95000000-0000-4000-8000-0000000000c1', 'Hi')$$,
  '42501', 'new row violates row-level security policy for table "comments"', 'Unverified accounts cannot comment');

-- Signed out
set local role anon;
select throws_ok($$select body from public.comments$$,
  '42501', 'permission denied for table comments', 'Signed-out users cannot read comments');

select * from finish();
rollback;
