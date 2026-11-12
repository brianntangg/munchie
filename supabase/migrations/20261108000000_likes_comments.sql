-- Sprint 4: likes and comments on posts (#35).
-- Members like a post at most once and comment as themselves; each member removes only their own.
-- Both go away with their post or their author's profile.
-- A surrogate id keeps (post_id, author_id) out of the primary key. Otherwise PostgREST treats likes as a
-- join table between posts and profiles, and every existing posts -> profiles embed becomes ambiguous.
create table public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint likes_one_per_member unique (post_id, author_id)
);
create index likes_author on public.likes (author_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  -- At most 280 characters as stored, and at least one non-whitespace character. (trim() only strips spaces,
  -- so it would let a comment of only newlines or tabs through, and measuring after trimming would let padding
  -- carry a comment past 280.)
  body text not null check (char_length(body) <= 280 and body ~ '\S'),
  created_at timestamptz not null default now()
);
-- Serves "this post's comments, oldest first".
create index comments_post on public.comments (post_id, created_at, id);
create index comments_author on public.comments (author_id);

alter table public.likes enable row level security;
alter table public.comments enable row level security;
revoke all on public.likes, public.comments from anon, authenticated;
grant select, delete on public.likes, public.comments to authenticated;
-- The author and timestamp always come from the server (column defaults); clients send only the post and text.
-- Comments cannot be edited, so there is no update grant.
grant insert (post_id) on public.likes to authenticated;
grant insert (post_id, body) on public.comments to authenticated;

create policy members_read_likes on public.likes for select to authenticated using ((select private.is_member()));
create policy members_like_as_self on public.likes for insert to authenticated
with check ((select private.is_member()) and author_id = (select auth.uid()));
create policy members_unlike_own on public.likes for delete to authenticated
using ((select private.is_member()) and author_id = (select auth.uid()));

create policy members_read_comments on public.comments for select to authenticated using ((select private.is_member()));
create policy members_comment_as_self on public.comments for insert to authenticated
with check ((select private.is_member()) and author_id = (select auth.uid()));
create policy members_delete_own_comments on public.comments for delete to authenticated
using ((select private.is_member()) and author_id = (select auth.uid()));
