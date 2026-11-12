-- A post can have up to 5 photos, each optionally tagged with the dish it shows.
-- Slot 0 is the cover: the photo and dish already stored on the post. A trigger records it, so every post has a
-- cover row without the client sending one. Clients add only the extra photos (slots 1-4).
alter table public.posts add constraint posts_id_hall_key unique (id, dining_hall_id);

create table public.post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  dining_hall_id uuid not null,
  -- The range is the photo limit; the unique constraint below keeps slots distinct within a post.
  slot smallint not null check (slot between 0 and 4),
  photo_path text unique not null,
  menu_item_id uuid,
  constraint post_photos_one_slot unique (post_id, slot),
  -- A dish can be tagged once per post; its rating is one score per member and dish.
  constraint post_photos_one_dish unique (post_id, menu_item_id),
  constraint post_photos_post_fkey foreign key (post_id, dining_hall_id)
    references public.posts (id, dining_hall_id) on delete cascade,
  -- Same rule as posts: a tagged dish must be served at the post's own hall.
  constraint post_photos_dish_in_hall_fkey foreign key (menu_item_id, dining_hall_id)
    references public.menu_items (id, dining_hall_id),
  -- Photos are stored at author/photo-id.jpg; the cover's photo id is the post id.
  constraint post_photos_cover_id check (slot > 0 or id = post_id)
);
create index post_photos_post on public.post_photos (post_id);

-- Existing posts become one-photo posts.
insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_id)
select id, id, dining_hall_id, 0, photo_path, menu_item_id from public.posts;

create function private.add_cover_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.post_photos (id, post_id, dining_hall_id, slot, photo_path, menu_item_id)
  values (new.id, new.id, new.dining_hall_id, 0, new.photo_path, new.menu_item_id);
  return new;
end;
$$;
create trigger posts_add_cover_photo after insert on public.posts
for each row execute function private.add_cover_photo();

alter table public.post_photos enable row level security;
revoke all on public.post_photos from anon, authenticated;
grant select on public.post_photos to authenticated;
grant insert (id, post_id, dining_hall_id, slot, photo_path, menu_item_id) on public.post_photos to authenticated;

create policy members_read_post_photos on public.post_photos for select to authenticated using ((select private.is_member()));
-- Only the post's author can add photos, only extras (the cover comes from the post), only uploaded files in their own
-- folder, and a published photo can never be changed or removed.
create policy members_add_post_photos on public.post_photos for insert to authenticated
with check (
  (select private.is_member())
  and slot > 0
  and exists (select 1 from public.posts where posts.id = post_id and posts.author_id = (select auth.uid()))
  and photo_path = (select auth.uid())::text || '/' || id::text || '.jpg'
  and exists (select 1 from storage.objects where bucket_id = 'food-photos' and name = photo_path)
);

-- Failed uploads may be cleaned up, but a photo that belongs to a post cannot be removed.
drop policy members_remove_unused_photos on storage.objects;
create policy members_remove_unused_photos on storage.objects for delete to authenticated
using (bucket_id = 'food-photos' and (select private.is_member())
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.posts where photo_path = name)
  and not exists (select 1 from public.post_photos where photo_path = name));
