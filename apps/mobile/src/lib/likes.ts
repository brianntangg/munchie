import { supabase } from './supabase';

export type LikeSummary = { count: number; likedByMe: boolean };

// Likes the post as the signed-in member. Liking a post twice is harmless: the second like is ignored.
export async function likePost(postId: string): Promise<void> {
  const { error } = await supabase.from('likes').insert({ post_id: postId });
  // 23505: this member already likes the post, which is the state the caller wanted.
  if (error && error.code !== '23505') throw error;
}

// Removes the signed-in member's like. Row-level security limits deletes to the member's own like,
// so this never removes anyone else's. Unliking a post that is not liked does nothing.
export async function unlikePost(postId: string): Promise<void> {
  const { error } = await supabase.from('likes').delete().eq('post_id', postId);
  if (error) throw error;
}

// Like count and whether the signed-in member likes each post, for a page of posts in one request.
// Every requested post gets an entry, so posts without likes show 0. Reads each like row, which is fine at campus scale.
export async function loadLikes(postIds: string[]): Promise<Record<string, LikeSummary>> {
  const summaries: Record<string, LikeSummary> = {};
  for (const id of postIds) summaries[id] = { count: 0, likedByMe: false };
  if (!postIds.length) return summaries;
  const [{ data: { session }, error: sessionError }, { data, error }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from('likes').select('post_id, author_id').in('post_id', postIds),
  ]);
  if (sessionError) throw sessionError;
  if (error) throw error;
  for (const like of data) {
    const summary = summaries[like.post_id];
    if (!summary) continue;
    summary.count += 1;
    if (like.author_id === session?.user.id) summary.likedByMe = true;
  }
  return summaries;
}
