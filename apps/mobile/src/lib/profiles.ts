import { supabase } from './supabase';

export type Profile = { id: string; displayName: string; postCount: number };

// Returns null when no member has this id, so the screen can say the student was not found.
export async function loadProfile(id: string): Promise<Profile | null> {
  const [profile, posts] = await Promise.all([
    supabase.from('profiles').select('id, display_name').eq('id', id).maybeSingle(),
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', id),
  ]);
  if (profile.error) throw profile.error;
  if (posts.error) throw posts.error;
  if (!profile.data) return null;
  return { id: profile.data.id, displayName: profile.data.display_name, postCount: posts.count ?? 0 };
}

export function postCountLabel(count: number) {
  return `${count} ${count === 1 ? 'post' : 'posts'}`;
}
