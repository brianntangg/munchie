-- Limit how fast one member can comment (security finding: comment flooding).
-- Nothing limited comment writes, so one signed-in member could post 100 comments in about a second and bury any post's
-- discussion or fill the table. A member may now post at most 10 comments in any minute; the next one is refused with
-- HTTP 429 until older ones age out. Normal conversation stays well under this.
create function private.limit_comment_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- One member's comments are checked one at a time, so parallel requests cannot all pass the count together.
  perform pg_advisory_xact_lock(hashtextextended('comment-rate:' || new.author_id::text, 0));
  if (select count(*) from public.comments
      where author_id = new.author_id and created_at > now() - interval '1 minute') >= 10 then
    -- PostgREST turns SQLSTATE PTxyz into HTTP status xyz.
    raise sqlstate 'PT429' using message = 'You are commenting too fast. Wait a minute, then try again.';
  end if;
  return new;
end;
$$;
create trigger comments_limit_rate before insert on public.comments
for each row execute function private.limit_comment_rate();

-- Serves the trigger's count of a member's recent comments.
create index comments_author_recent on public.comments (author_id, created_at);
