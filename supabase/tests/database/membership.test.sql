begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select throws_ok($$insert into auth.users(id, email) values ('90000000-0000-4000-8000-000000000001', 'outsider@example.com')$$,
  'P0001', 'Use your Vanderbilt email address.', 'Server rejects outside domains');
insert into auth.users(id, email, email_confirmed_at) values
('90000000-0000-4000-8000-000000000001', 'verified@vanderbilt.edu', now()),
('90000000-0000-4000-8000-000000000002', 'pending@vanderbilt.edu', null);
select throws_ok($$update auth.users set email = 'outside@example.com' where id = '90000000-0000-4000-8000-000000000001'$$,
  'P0001', 'Use your Vanderbilt email address.', 'Email changes cannot leave the allowed domain');

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);
select is(private.is_member(), false, 'An unverified account is not eligible');
select is((select count(*) from public.dining_halls), 0::bigint, 'Unverified accounts cannot read campus data');
select throws_ok($$insert into public.profiles(id, display_name) values ('90000000-0000-4000-8000-000000000002', 'Pending')$$,
  '42501', 'new row violates row-level security policy for table "profiles"', 'Unverified accounts cannot create profiles');

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select is(private.is_member(), true, 'A confirmed campus account is eligible');
select ok((select count(*) from public.dining_halls) > 0, 'Members can read seeded dining halls');
insert into public.profiles(id, display_name) values ('90000000-0000-4000-8000-000000000001', 'Verified');
select throws_ok($$insert into public.posts(id, author_id, dining_hall_id, photo_path) values (
'90000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001',
'10000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001/90000000-0000-4000-8000-000000000003.jpg')$$,
  '42501', 'new row violates row-level security policy for table "posts"', 'A post requires an uploaded photo');
select throws_ok($$update public.profiles set id = '90000000-0000-4000-8000-000000000002' where id = '90000000-0000-4000-8000-000000000001'$$,
  '42501', 'new row violates row-level security policy for table "profiles"', 'Profile IDs cannot be reassigned');

select * from finish();
rollback;
