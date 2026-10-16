-- Posts can name a dish, which must belong to the post's dining hall.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users(id, email, email_confirmed_at) values
('94000000-0000-4000-8000-000000000011', 'dish-author@vanderbilt.edu', now());
insert into public.profiles (id, display_name) values ('94000000-0000-4000-8000-000000000011', 'Dish Author');
insert into public.menu_items (id, dining_hall_id, name) values
('94000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000001', 'Rand Dish'),
('94000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-000000000002', 'Commons Dish');
insert into storage.objects (bucket_id, name, owner_id) values
('food-photos', '94000000-0000-4000-8000-000000000011/94000000-0000-4000-8000-0000000000b1.jpg', '94000000-0000-4000-8000-000000000011'),
('food-photos', '94000000-0000-4000-8000-000000000011/94000000-0000-4000-8000-0000000000b2.jpg', '94000000-0000-4000-8000-000000000011'),
('food-photos', '94000000-0000-4000-8000-000000000011/94000000-0000-4000-8000-0000000000b3.jpg', '94000000-0000-4000-8000-000000000011');

set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000011', true);

select lives_ok($$insert into public.posts (id, author_id, dining_hall_id, photo_path, menu_item_id) values
  ('94000000-0000-4000-8000-0000000000b1', '94000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001',
   '94000000-0000-4000-8000-000000000011/94000000-0000-4000-8000-0000000000b1.jpg', '94000000-0000-4000-8000-0000000000a1')$$,
  'A post can name a dish served at its dining hall');
select throws_ok($$insert into public.posts (id, author_id, dining_hall_id, photo_path, menu_item_id) values
  ('94000000-0000-4000-8000-0000000000b2', '94000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001',
   '94000000-0000-4000-8000-000000000011/94000000-0000-4000-8000-0000000000b2.jpg', '94000000-0000-4000-8000-0000000000a2')$$,
  '23503', null, 'A post cannot name a dish from a different dining hall');
select throws_ok($$insert into public.posts (id, author_id, dining_hall_id, photo_path, menu_item_id) values
  ('94000000-0000-4000-8000-0000000000b2', '94000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001',
   '94000000-0000-4000-8000-000000000011/94000000-0000-4000-8000-0000000000b2.jpg', '94000000-0000-4000-8000-0000000000ff')$$,
  '23503', null, 'A post cannot name a dish that does not exist');
select lives_ok($$insert into public.posts (id, author_id, dining_hall_id, photo_path) values
  ('94000000-0000-4000-8000-0000000000b3', '94000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001',
   '94000000-0000-4000-8000-000000000011/94000000-0000-4000-8000-0000000000b3.jpg')$$,
  'A post without a dish is still allowed');
select is((select menu_items.name from public.posts join public.menu_items on menu_items.id = posts.menu_item_id
  where posts.id = '94000000-0000-4000-8000-0000000000b1'), 'Rand Dish', 'The post joins to its dish');
select throws_ok($$update public.posts set menu_item_id = '94000000-0000-4000-8000-0000000000a1' where id = '94000000-0000-4000-8000-0000000000b3'$$,
  '42501', 'permission denied for table posts', 'A published post cannot be given a dish afterward');

select * from finish();
rollback;
