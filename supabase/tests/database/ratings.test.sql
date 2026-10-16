-- Dish ratings: score boundaries (1-5), one rating per member per dish,
-- members change only their own score, and non-members cannot read or rate.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Fixtures, created as the table owner.
insert into auth.users(id, email, email_confirmed_at) values
('93000000-0000-4000-8000-000000000001', 'rater-a@vanderbilt.edu', now()),
('93000000-0000-4000-8000-000000000002', 'rater-b@vanderbilt.edu', now()),
('93000000-0000-4000-8000-000000000003', 'rater-pending@vanderbilt.edu', null);
insert into public.profiles(id, display_name) values
('93000000-0000-4000-8000-000000000001', 'Rater A'),
('93000000-0000-4000-8000-000000000002', 'Rater B');
insert into public.menu_items(id, dining_hall_id, name) values
('93000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 'Rating Test Dish 1'),
('93000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', 'Rating Test Dish 2'),
('93000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', 'Rating Test Dish 3');

-- Member A
set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000001', true);

select lives_ok($$insert into public.ratings (menu_item_id, score) values ('93000000-0000-4000-8000-000000000011', 1)$$,
  'The lowest score (1) is accepted');
select lives_ok($$insert into public.ratings (menu_item_id, score) values ('93000000-0000-4000-8000-000000000012', 5)$$,
  'The highest score (5) is accepted');
select throws_ok($$insert into public.ratings (menu_item_id, score) values ('93000000-0000-4000-8000-000000000013', 0)$$,
  '23514', null, 'A score of 0 is rejected');
select throws_ok($$insert into public.ratings (menu_item_id, score) values ('93000000-0000-4000-8000-000000000013', 6)$$,
  '23514', null, 'A score of 6 is rejected');
select throws_ok($$insert into public.ratings (menu_item_id, score) values ('93000000-0000-4000-8000-000000000011', 3)$$,
  '23505', null, 'A member cannot rate the same dish twice');
select throws_ok($$insert into public.ratings (menu_item_id, score) values ('93000000-0000-4000-8000-0000000000ff', 3)$$,
  '23503', null, 'A rating must point at an existing menu item');
select throws_ok($$insert into public.ratings (author_id, menu_item_id, score) values ('93000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000013', 3)$$,
  '42501', 'permission denied for table ratings', 'A member cannot rate as someone else');
select lives_ok($$update public.ratings set score = 4 where menu_item_id = '93000000-0000-4000-8000-000000000011'$$,
  'A member can change their own score');
select is((select score from public.ratings where menu_item_id = '93000000-0000-4000-8000-000000000011'), 4::smallint,
  'The changed score is saved');
select throws_ok($$delete from public.ratings where menu_item_id = '93000000-0000-4000-8000-000000000011'$$,
  '42501', 'permission denied for table ratings', 'Members cannot delete ratings');

-- Member B
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.ratings where author_id = '93000000-0000-4000-8000-000000000001'), 2::bigint,
  'Members can read other members'' ratings');
update public.ratings set score = 1 where author_id = '93000000-0000-4000-8000-000000000001';
select is((select score from public.ratings where author_id = '93000000-0000-4000-8000-000000000001'
  and menu_item_id = '93000000-0000-4000-8000-000000000011'), 4::smallint,
  'A member cannot change someone else''s rating');

-- Unverified account
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000003', true);
select is((select count(*) from public.ratings), 0::bigint, 'Unverified accounts cannot read ratings');
select throws_ok($$insert into public.ratings (menu_item_id, score) values ('93000000-0000-4000-8000-000000000013', 3)$$,
  '42501', 'new row violates row-level security policy for table "ratings"', 'Unverified accounts cannot rate');

-- Signed out
set local role anon;
select throws_ok($$select id from public.ratings$$,
  '42501', 'permission denied for table ratings', 'Signed-out users cannot read ratings');

select * from finish();
rollback;
