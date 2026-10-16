-- Menu items: data integrity rules, and members can read but never change them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Integrity rules, checked as the table owner (the way the importer loads data).
insert into public.menu_items (id, dining_hall_id, name, category) values
('92000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Test Dish', 'Test Station');
select throws_ok($$insert into public.menu_items (dining_hall_id, name) values ('10000000-0000-4000-8000-000000000001', 'Test Dish')$$,
  '23505', null, 'A hall cannot list the same dish twice');
select lives_ok($$insert into public.menu_items (dining_hall_id, name) values ('10000000-0000-4000-8000-000000000002', 'Test Dish')$$,
  'Two halls can serve a dish with the same name');
select throws_ok($$insert into public.menu_items (dining_hall_id, name) values ('92000000-0000-4000-8000-0000000000ff', 'Ghost Dish')$$,
  '23503', null, 'A menu item must belong to an existing hall');
select throws_ok($$insert into public.menu_items (dining_hall_id, name) values ('10000000-0000-4000-8000-000000000001', '   ')$$,
  '23514', null, 'A blank dish name is rejected');
select throws_ok($$insert into public.menu_items (dining_hall_id, name) values ('10000000-0000-4000-8000-000000000001', repeat('x', 201))$$,
  '23514', null, 'A 201-character dish name is rejected');

insert into auth.users(id, email, email_confirmed_at) values
('92000000-0000-4000-8000-000000000011', 'menu-verified@vanderbilt.edu', now()),
('92000000-0000-4000-8000-000000000012', 'menu-pending@vanderbilt.edu', null);

set local role anon;
select throws_ok($$select id from public.menu_items$$,
  '42501', 'permission denied for table menu_items', 'Signed-out users cannot read menu items');

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000012', true);
select is((select count(*) from public.menu_items where id = '92000000-0000-4000-8000-000000000001'), 0::bigint,
  'Unverified accounts cannot read menu items');

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000011', true);
select is((select name from public.menu_items where id = '92000000-0000-4000-8000-000000000001'), 'Test Dish',
  'Members can read menu items');
select throws_ok($$insert into public.menu_items (dining_hall_id, name) values ('10000000-0000-4000-8000-000000000001', 'Member Dish')$$,
  '42501', 'permission denied for table menu_items', 'Members cannot add menu items');
select throws_ok($$update public.menu_items set name = 'Renamed' where id = '92000000-0000-4000-8000-000000000001'$$,
  '42501', 'permission denied for table menu_items', 'Members cannot change menu items');
select throws_ok($$delete from public.menu_items where id = '92000000-0000-4000-8000-000000000001'$$,
  '42501', 'permission denied for table menu_items', 'Members cannot delete menu items');

select * from finish();
rollback;
