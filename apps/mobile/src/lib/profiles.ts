import { supabase } from './supabase';

export type Profile = { id: string; displayName: string; postCount: number; followerCount: number; followingCount: number };

// Counts use head-only queries, so no post or follow rows are downloaded.
const count = (table: 'posts' | 'follows', column: string, id: string) =>
  supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, id);

// Returns null when no member has this id, so the screen can say the student was not found.
export async function loadProfile(id: string): Promise<Profile | null> {
  const [profile, posts, followers, following] = await Promise.all([
    supabase.from('profiles').select('id, display_name').eq('id', id).maybeSingle(),
    count('posts', 'author_id', id),
    count('follows', 'followee_id', id),
    count('follows', 'follower_id', id),
  ]);
  const error = profile.error || posts.error || followers.error || following.error;
  if (error) throw error;
  if (!profile.data) return null;
  return {
    id: profile.data.id,
    displayName: profile.data.display_name,
    postCount: posts.count ?? 0,
    followerCount: followers.count ?? 0,
    followingCount: following.count ?? 0,
  };
}

// Just the member's display name, for the header avatar: one query and no counts, so a failed count cannot hide the name.
// Null when no member has this id.
export async function loadDisplayName(id: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('display_name').eq('id', id).maybeSingle();
  if (error) throw error;
  return data?.display_name ?? null;
}

export function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
