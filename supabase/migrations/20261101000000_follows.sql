-- Sprint 4: one-way follows between members (#36, #53).
-- A member follows another member at most once, never themselves, and only as themselves.
create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);
-- The primary key serves "who does X follow"; this index serves "who follows X" (follower counts).
create index follows_followee on public.follows (followee_id);

alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;
grant select, delete on public.follows to authenticated;
-- The follower always comes from the session (column default); clients send only who they follow.
grant insert (followee_id) on public.follows to authenticated;

create policy members_read_follows on public.follows for select to authenticated using ((select private.is_member()));
create policy members_follow_as_self on public.follows for insert to authenticated
with check ((select private.is_member()) and follower_id = (select auth.uid()));
create policy members_unfollow_as_self on public.follows for delete to authenticated
using ((select private.is_member()) and follower_id = (select auth.uid()));
