import { supabase } from './supabase';

export type LikeSummary = { count: number; likedByMe: boolean };

// The signed-in member's id. Writes name the member's own row as well as relying on row-level security,
// the same as submitRating (#65).
async function signedInId(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error('Sign in to like posts.');
  return session.user.id;
}

// What a post's like button shows right after a tap: one more like, or one fewer, and the heart flipped.
export function toggledLike({ count, likedByMe }: LikeSummary): LikeSummary {
  return likedByMe ? { count: Math.max(0, count - 1), likedByMe: false } : { count: count + 1, likedByMe: true };
}

// Likes the post as the signed-in member. Liking a post twice is harmless: the second like is ignored.
export async function likePost(postId: string): Promise<void> {
  const { error } = await supabase.from('likes').insert({ post_id: postId });
  // 23505: this member already likes the post, which is the state the caller wanted.
  if (error && error.code !== '23505') throw error;
}

// Removes the signed-in member's like. Unliking a post that is not liked does nothing.
export async function unlikePost(postId: string): Promise<void> {
  const userId = await signedInId();
  const { error } = await supabase.from('likes').delete().eq('post_id', postId).eq('author_id', userId);
  if (error) throw error;
}

// Like count, and whether `viewerId` likes it, for each post on a feed page. Every requested post gets an entry.
// Counts come from count-only requests, so no like rows are downloaded and the API's 1,000-row limit (max_rows)
// never cuts them short. The viewer's own likes are at most one row per post.
export async function loadLikes(postIds: string[], viewerId: string | null): Promise<Record<string, LikeSummary>> {
  const ids = [...new Set(postIds)];
  if (!ids.length) return {};
  const counts = Promise.all(ids.map(async (id) => {
    const { count, error } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', id);
    if (error) throw error;
    return count ?? 0;
  }));
  const mine = (async () => {
    if (!viewerId) return new Set<string>();
    const { data, error } = await supabase.from('likes').select('post_id').eq('author_id', viewerId).in('post_id', ids);
    if (error) throw error;
    return new Set(data.map((like) => like.post_id));
  })();
  const [totals, liked] = await Promise.all([counts, mine]);
  return Object.fromEntries(ids.map((id, index) => [id, { count: totals[index], likedByMe: liked.has(id) }]));
}
