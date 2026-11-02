import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import type { Tables } from './database.types';

export type FeedPost = Tables<'posts'> & { profiles: { display_name: string }; dining_halls: { name: string }; imageUrl: string | null };
export const PAGE_SIZE = 20;
export async function loadPosts(cursor?: { created_at: string; id: string }, filters?: { hallId?: string; authorId?: string }): Promise<FeedPost[]> {
  let query = supabase.from('posts').select('*, profiles!inner(display_name), dining_halls!inner(name)').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE);
  if (filters?.hallId) query = query.eq('dining_hall_id', filters.hallId);
  if (filters?.authorId) query = query.eq('author_id', filters.authorId);
  if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const { data, error } = await query;
  if (error) throw error;
  if (!data.length) return [];
  const { data: urls, error: urlError } = await supabase.storage.from('food-photos').createSignedUrls(data.map((post) => post.photo_path), 3600);
  if (urlError) throw urlError;
  return data.map((post, index) => ({ ...post, imageUrl: urls[index]?.signedUrl || null }));
}

// Stable IDs make retrying an interrupted submission safe.
export async function publishPost({ id, userId, hallId, caption, base64 }: { id: string; userId: string; hallId: string; caption: string; base64: string }) {
  const path = `${userId}/${id}.jpg`;
  const { data: existing, error: checkError } = await supabase.from('posts').select('id').eq('id', id).maybeSingle();
  if (checkError) throw checkError;
  if (existing) return;
  const bytes = decode(base64);
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('Choose a smaller photo (maximum 5 MB).');
  const { error: uploadError } = await supabase.storage.from('food-photos').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  // A previous attempt may have uploaded the photo before losing connectivity.
  if (uploadError && !('statusCode' in uploadError && String(uploadError.statusCode) === '409')) throw uploadError;
  const { error } = await supabase.from('posts').insert({ id, author_id: userId, dining_hall_id: hallId, caption: caption.trim(), photo_path: path });
  if (error) {
    const { data: committed, error: lookupError } = await supabase.from('posts').select('id').eq('id', id).maybeSingle();
    if (committed) return;
    // Never delete the photo when commit status is unknown. RLS also protects published images.
    if (!lookupError) await supabase.storage.from('food-photos').remove([path]);
    throw error;
  }
}

export async function loadPost(id: string): Promise<FeedPost | null> {
  const { data, error } = await supabase.from('posts').select('*, profiles!inner(display_name), dining_halls!inner(name)').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: photo, error: photoError } = await supabase.storage.from('food-photos').createSignedUrl(data.photo_path, 3600);
  if (photoError) throw photoError;
  return { ...data, imageUrl: photo.signedUrl };
}
