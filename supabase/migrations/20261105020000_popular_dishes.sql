-- A hall's most-rated dishes, so the photo screen can offer a few quick taps before the member types.
-- Counting happens here, not in the app, so the app never downloads ratings to rank dishes. It runs as the caller,
-- so the same row-level security applies: only verified members get any rows. Only dishes with at least one rating
-- are returned (ties alphabetically), so the screen never labels an alphabetical list as popular. The count uses the ratings_menu_item index.
create function public.popular_dishes(hall_id uuid, max_results integer default 8)
returns table (id uuid, name text, category text)
language sql stable security invoker set search_path = '' as $$
  select item.id, item.name, item.category
  from public.menu_items as item
  join public.ratings as rating on rating.menu_item_id = item.id
  where item.dining_hall_id = hall_id
  group by item.id
  order by count(rating.id) desc, item.name
  limit least(greatest(max_results, 1), 20);
$$;
revoke all on function public.popular_dishes(uuid, integer) from public, anon;
grant execute on function public.popular_dishes(uuid, integer) to authenticated;
