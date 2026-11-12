import type { Tables } from './database.types';
import { supabase } from './supabase';

export const MAX_COMMENT_LENGTH = 280;
// The API returns at most this many rows per request (max_rows in supabase/config.toml).
const PAGE_ROWS = 1000;

export type Comment = { id: string; postId: string; authorId: string; authorName: string; body: string; createdAt: string };

const COLUMNS = 'id, post_id, author_id, body, created_at, profiles(display_name)';
type Row = Pick<Tables<'comments'>, 'id' | 'post_id' | 'author_id' | 'body' | 'created_at'> & { profiles: { display_name: string } | null };
const toComment = (row: Row): Comment => ({
  id: row.id,
  postId: row.post_id,
  authorId: row.author_id,
  authorName: row.profiles?.display_name ?? 'Student',
  body: row.body,
  createdAt: row.created_at,
});

// The signed-in member's id. Deletes name the member's own row as well as relying on row-level security,
// the same as submitRating (#65).
async function signedInId(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error('Sign in to delete comments.');
  return session.user.id;
}

// 1-280 characters after trimming, counted the way the database counts them: by code point, so an emoji is one.
// The comment box uses this to enable Send; the database enforces the same rule.
export function isValidComment(body: string): boolean {
  const length = [...body.trim()].length;
  return length >= 1 && length <= MAX_COMMENT_LENGTH;
}

// A post's comments, oldest first, with each author's display name. Reads page by page, so a busy post is not cut
// off at the API's row limit; ordered by time, then id, so no comment is skipped or repeated between pages.
export async function loadComments(postId: string): Promise<Comment[]> {
  const comments: Comment[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await supabase.from('comments').select(COLUMNS).eq('post_id', postId)
      .order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, from + PAGE_ROWS - 1);
    if (error) throw error;
    comments.push(...data.map(toComment));
    if (data.length < PAGE_ROWS) return comments;
  }
}

// Posts a comment as the signed-in member and returns it, so the screen can show it without reloading.
export async function addComment({ postId, body }: { postId: string; body: string }): Promise<Comment> {
  if (!isValidComment(body)) throw new Error(`Comments must be 1 to ${MAX_COMMENT_LENGTH} characters.`);
  const { data, error } = await supabase.from('comments').insert({ post_id: postId, body: body.trim() }).select(COLUMNS).single();
  if (error) throw error;
  return toComment(data);
}

// Deletes one of the signed-in member's comments. A comment that is already gone (a double tap, or deleted on another
// device) counts as deleted. Only a comment that still exists but belongs to someone else is an error.
export async function deleteComment(id: string): Promise<void> {
  const userId = await signedInId();
  const { data, error } = await supabase.from('comments').delete().eq('id', id).eq('author_id', userId).select('id');
  if (error) throw error;
  if (data.length) return;
  const { data: remaining, error: lookupError } = await supabase.from('comments').select('id').eq('id', id).maybeSingle();
  if (lookupError) throw lookupError;
  if (remaining) throw new Error('You can only delete your own comments.');
}
