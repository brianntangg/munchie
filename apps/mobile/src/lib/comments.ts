import { supabase } from './supabase';

export const MAX_COMMENT_LENGTH = 280;

export type Comment = { id: string; postId: string; authorId: string; authorName: string; body: string; createdAt: string };

const COLUMNS = 'id, post_id, author_id, body, created_at, profiles(display_name)';
type Row = { id: string; post_id: string; author_id: string; body: string; created_at: string; profiles: { display_name: string } | null };
const toComment = (row: Row): Comment => ({
  id: row.id,
  postId: row.post_id,
  authorId: row.author_id,
  authorName: row.profiles?.display_name ?? 'Student',
  body: row.body,
  createdAt: row.created_at,
});

// 1-280 characters after trimming. The comment box uses this to enable Send; the database enforces the same rule.
export function isValidComment(body: string): boolean {
  const length = body.trim().length;
  return length >= 1 && length <= MAX_COMMENT_LENGTH;
}

// A post's comments, oldest first, with each author's display name.
export async function loadComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase.from('comments').select(COLUMNS).eq('post_id', postId)
    .order('created_at', { ascending: true }).order('id', { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(toComment);
}

// Posts a comment as the signed-in member and returns it, so the screen can show it without reloading.
export async function addComment({ postId, body }: { postId: string; body: string }): Promise<Comment> {
  if (!isValidComment(body)) throw new Error(`Comments must be 1 to ${MAX_COMMENT_LENGTH} characters.`);
  const { data, error } = await supabase.from('comments').insert({ post_id: postId, body: body.trim() }).select(COLUMNS).single();
  if (error) throw error;
  return toComment(data as Row);
}

// Deletes one of the signed-in member's comments. Row-level security silently skips other members'
// comments, so an empty result means the comment was not theirs (or is already gone).
export async function deleteComment(id: string): Promise<void> {
  const { data, error } = await supabase.from('comments').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data.length) throw new Error('You can only delete your own comments.');
}
