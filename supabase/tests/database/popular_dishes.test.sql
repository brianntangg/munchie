-- popular_dishes ranks a hall's rated dishes by how many ratings they have, ties alphabetically, leaves unrated dishes out,
-- is capped, stays inside the hall, and returns nothing to people who are not verified members.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Fixtures, created as the table owner, in a hall of their own so seeded dishes and earlier ratings cannot interfere.
insert into public.dining_halls(id, name) values ('96000000-0000-4000-8000-0000000000f1', 'Popular Test Hall'), ('96000000-0000-4000-8000-0000000000f2', 'Other Test Hall');
insert into auth.users(id, email, email_confirmed_at) values
('96000000-0000-4000-8000-000000000001', 'popular-a@vanderbilt.edu', now()),
('96000000-0000-4000-8000-000000000002', 'popular-b@vanderbilt.edu', now()),
('96000000-0000-4000-8000-000000000003', 'popular-pending@vanderbilt.edu', null);
insert into public.profiles(id, display_name) values
('96000000-0000-4000-8000-000000000001', 'Popular A'),
('96000000-0000-4000-8000-000000000002', 'Popular B');
insert into public.menu_items(id, dining_hall_id, name, category) values
('96000000-0000-4000-8000-0000000000a1', '96000000-0000-4000-8000-0000000000f1', 'Zucchini Bake', 'Veg'),
('96000000-0000-4000-8000-0000000000a2', '96000000-0000-4000-8000-0000000000f1', 'Apple Pie', null),
('96000000-0000-4000-8000-0000000000a3', '96000000-0000-4000-8000-0000000000f1', 'Burger', 'Grill'),
('96000000-0000-4000-8000-0000000000a4', '96000000-0000-4000-8000-0000000000f1', 'Chili', 'Soup'),
('96000000-0000-4000-8000-0000000000a5', '96000000-0000-4000-8000-0000000000f2', 'Elsewhere Dish', null);
-- Zucchini Bake has two ratings, Burger one, the rest none.
insert into public.ratings(author_id, menu_item_id, score) values
('96000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-0000000000a1', 5),
('96000000-0000-4000-8000-000000000002', '96000000-0000-4000-8000-0000000000a1', 3),
('96000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-0000000000a3', 4),
('96000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-0000000000a5', 5);

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000001', true);

select is((select array_agg(name order by ordinality) from public.popular_dishes('96000000-0000-4000-8000-0000000000f1') with ordinality),
  array['Zucchini Bake', 'Burger'], 'Rated dishes come back most-rated first, and unrated ones are left out');
select is((select count(*) from public.popular_dishes('96000000-0000-4000-8000-0000000000f1', 2)), 2::bigint, 'The result is limited to the requested number');
select is((select count(*) from public.popular_dishes('96000000-0000-4000-8000-0000000000f1', 0)), 1::bigint, 'Asking for none still returns one dish');
select is((select count(*) from public.popular_dishes('96000000-0000-4000-8000-0000000000f1', 1000)), 2::bigint, 'A huge request is capped but never returns more than the hall has rated');
select is((select category from public.popular_dishes('96000000-0000-4000-8000-0000000000f1') where name = 'Zucchini Bake'), 'Veg', 'Each dish comes with its station');
select is((select count(*) from public.popular_dishes('96000000-0000-4000-8000-0000000000f1') where name = 'Elsewhere Dish'), 0::bigint, 'Dishes from another hall are left out');

-- Unverified account
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000003', true);
select is((select count(*) from public.popular_dishes('96000000-0000-4000-8000-0000000000f1')), 0::bigint, 'Unverified accounts get no dishes');

-- Signed out
set local role anon;
select throws_ok($$select * from public.popular_dishes('96000000-0000-4000-8000-0000000000f1')$$,
  '42501', 'permission denied for function popular_dishes', 'Signed-out users cannot call it');

select * from finish();
rollback;
