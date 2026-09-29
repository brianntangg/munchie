-- Sprint 2: verified campus members, dining halls, and photo posts.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users where id = (select auth.uid())
      and email_confirmed_at is not null
      and lower(split_part(email, '@', 2)) = 'vanderbilt.edu'
      and coalesce(is_anonymous, false) = false
  );
$$;
revoke all on function private.is_member() from public;
grant execute on function private.is_member() to authenticated;

-- Also guards email changes; eligibility never relies on editable user metadata.
create function private.require_campus_email() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.email is null or new.email !~* '^[^@[:space:]]+@vanderbilt\.edu$' then
    raise exception 'Use your Vanderbilt email address.';
  end if;
  return new;
end;
$$;
create trigger require_campus_email before insert or update of email on auth.users
for each row execute function private.require_campus_email();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 40)
);
create table public.dining_halls (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (char_length(name) between 1 and 100)
);
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  dining_hall_id uuid not null references public.dining_halls(id),
  photo_path text unique not null,
  caption text not null default '' check (char_length(caption) <= 280),
  created_at timestamptz not null default now(),
  constraint owned_photo_path check (photo_path = author_id::text || '/' || id::text || '.jpg')
);
create index posts_feed on public.posts (created_at desc, id desc);
create index posts_author on public.posts (author_id);
create index posts_dining_hall on public.posts (dining_hall_id);

alter table public.profiles enable row level security;
alter table public.dining_halls enable row level security;
alter table public.posts enable row level security;
revoke all on public.profiles, public.dining_halls, public.posts from anon, authenticated;
grant select on public.profiles, public.dining_halls, public.posts to authenticated;
grant insert (id, display_name), update (id, display_name) on public.profiles to authenticated;
grant insert (id, author_id, dining_hall_id, photo_path, caption) on public.posts to authenticated;

create policy members_read_profiles on public.profiles for select to authenticated using ((select private.is_member()));
create policy members_create_profile on public.profiles for insert to authenticated with check ((select private.is_member()) and id = (select auth.uid()));
create policy members_edit_profile on public.profiles for update to authenticated using ((select private.is_member()) and id = (select auth.uid())) with check (id = (select auth.uid()));
create policy members_read_halls on public.dining_halls for select to authenticated using ((select private.is_member()));
create policy members_read_posts on public.posts for select to authenticated using ((select private.is_member()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-photos', 'food-photos', false, 5242880, array['image/jpeg']);
create policy members_read_photos on storage.objects for select to authenticated
using (bucket_id = 'food-photos' and (select private.is_member()));
create policy members_upload_photos on storage.objects for insert to authenticated
with check (bucket_id = 'food-photos' and (select private.is_member())
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.jpg$'));
-- Failed uploads may be cleaned up, but a published photo cannot be removed.
create policy members_remove_unused_photos on storage.objects for delete to authenticated
using (bucket_id = 'food-photos' and (select private.is_member())
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.posts where photo_path = name));
create policy members_create_posts on public.posts for insert to authenticated
with check ((select private.is_member()) and author_id = (select auth.uid())
  and exists (select 1 from storage.objects where bucket_id = 'food-photos' and name = photo_path));

-- App reference data must also exist after a hosted migration (not just db reset).
insert into public.dining_halls (id, name) values
('10000000-0000-4000-8000-000000000001', 'Rand'),
('10000000-0000-4000-8000-000000000002', 'Commons'),
('10000000-0000-4000-8000-000000000003', 'E. Bronson Ingram'),
('10000000-0000-4000-8000-000000000004', 'Rothschild'),
('10000000-0000-4000-8000-000000000005', 'Zeppos');
