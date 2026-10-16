-- Hall hours: shape rules, and members can read hours but never change them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select lives_ok($$update public.dining_halls set hours = null where id = '10000000-0000-4000-8000-000000000001'$$,
  'Unknown hours (null) are allowed');
select lives_ok($$update public.dining_halls set hours = '{"Sunday":[],"Monday":[["07:00","15:00"]],"Tuesday":[],"Wednesday":[],"Thursday":[],"Friday":[],"Saturday":[]}'
  where id = '10000000-0000-4000-8000-000000000001'$$, 'A full week of hours is accepted');
select throws_ok($$update public.dining_halls set hours = '{"Monday":[]}' where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'Hours missing a day are rejected');
select throws_ok($$update public.dining_halls set hours = '[]' where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'Hours that are not an object are rejected');

insert into auth.users(id, email, email_confirmed_at) values
('93000000-0000-4000-8000-000000000011', 'hours-verified@vanderbilt.edu', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000011', true);
select is((select hours -> 'Monday' ->> 0 from public.dining_halls where id = '10000000-0000-4000-8000-000000000001'), '["07:00", "15:00"]',
  'Members can read hall hours');
select throws_ok($$update public.dining_halls set hours = null where id = '10000000-0000-4000-8000-000000000001'$$,
  '42501', 'permission denied for table dining_halls', 'Members cannot change hall hours');
select throws_ok($$insert into public.dining_halls (name, hours) values ('Test Hall', null)$$,
  '42501', 'permission denied for table dining_halls', 'Members cannot add halls');

select * from finish();
rollback;
