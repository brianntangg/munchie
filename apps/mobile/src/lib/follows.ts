import { supabase } from './supabase';

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function followUser(followeeId: string): Promise<void> {
  const { error } = await supabase.from('follows').insert({ followee_id: followeeId });
  if (error) throw error;
}

export async function unfollowUser(followeeId: string): Promise<void> {
  const { error } = await supabase.from('follows').delete().eq('followee_id', followeeId);
  if (error) throw error;
}

export async function loadFollowingIds(followerId: string): Promise<string[]> {
  const { data, error } = await supabase.from('follows').select('followee_id').eq('follower_id', followerId);
  if (error) throw error;
  return data.map(({ followee_id }) => followee_id);
}

export type Connection = { id: string; displayName: string };
export async function loadConnections(userId: string, kind: 'followers' | 'following'): Promise<Connection[]> {
  const column = kind === 'followers' ? 'follower_id' : 'followee_id';
  const { data, error } = await supabase.from('follows').select('follower_id, followee_id').eq(kind === 'followers' ? 'followee_id' : 'follower_id', userId);
  if (error) throw error;
  const ids = data.map((follow) => follow[column]);
  if (!ids.length) return [];
  const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, display_name').in('id', ids);
  if (profileError) throw profileError;
  return profiles.map(({ id, display_name }) => ({ id, displayName: display_name }));
}
