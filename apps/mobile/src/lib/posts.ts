import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import type { Tables } from './database.types';

// `dish` is the menu item the post is about, with its author's current score for it (null if they have not rated it).
export type FeedPost = Tables<'posts'> & { profiles: { display_name: string }; dining_halls: { name: string }; imageUrl: string | null; dish: { name: string; score: number | null } | null };
export const PAGE_SIZE = 20;
const POST_COLUMNS = '*, profiles!inner(display_name), dining_halls!inner(name), menu_items(name)';
type PostRow = Tables<'posts'> & { menu_items: { name: string } | null };

// Ratings stay the single source of truth, so each post's score is looked up as its author's rating of the dish.
async function loadDishes(rows: PostRow[]): Promise<FeedPost['dish'][]> {
  const withDish = rows.filter((row) => row.menu_item_id && row.menu_items);
  const scores = new Map<string, number>();
  if (withDish.length) {
    const { data, error } = await supabase.from('ratings').select('author_id, menu_item_id, score')
      .in('menu_item_id', [...new Set(withDish.map((row) => row.menu_item_id!))]).in('author_id', [...new Set(withDish.map((row) => row.author_id))]);
    if (error) throw error;
    for (const rating of data) scores.set(`${rating.author_id}:${rating.menu_item_id}`, rating.score);
  }
  return rows.map((row) => (row.menu_item_id && row.menu_items ? { name: row.menu_items.name, score: scores.get(`${row.author_id}:${row.menu_item_id}`) ?? null } : null));
}
export async function loadPosts(cursor?: { created_at: string; id: string }, filters?: { hallId?: string; authorId?: string }): Promise<FeedPost[]> {
  let query = supabase.from('posts').select(POST_COLUMNS).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE);
  if (filters?.hallId) query = query.eq('dining_hall_id', filters.hallId);
  if (filters?.authorId) query = query.eq('author_id', filters.authorId);
  if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const { data, error } = await query;
  if (error) throw error;
  if (!data.length) return [];
  const { data: urls, error: urlError } = await supabase.storage.from('food-photos').createSignedUrls(data.map((post) => post.photo_path), 3600);
  if (urlError) throw urlError;
  const dishes = await loadDishes(data);
  return data.map((post, index) => ({ ...post, imageUrl: urls[index]?.signedUrl || null, dish: dishes[index] }));
}

// Stable IDs make retrying an interrupted submission safe.
export async function publishPost({ id, userId, hallId, menuItemId, caption, base64 }: { id: string; userId: string; hallId: string; menuItemId?: string; caption: string; base64: string }) {
  const path = `${userId}/${id}.jpg`;
  const { data: existing, error: checkError } = await supabase.from('posts').select('id').eq('id', id).maybeSingle();
  if (checkError) throw checkError;
  if (existing) return;
  const bytes = decode(base64);
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('Choose a smaller photo (maximum 5 MB).');
  const { error: uploadError } = await supabase.storage.from('food-photos').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  // A previous attempt may have uploaded the photo before losing connectivity.
  if (uploadError && !('statusCode' in uploadError && String(uploadError.statusCode) === '409')) throw uploadError;
  const { error } = await supabase.from('posts').insert({ id, author_id: userId, dining_hall_id: hallId, ...(menuItemId ? { menu_item_id: menuItemId } : {}), caption: caption.trim(), photo_path: path });
  if (error) {
    const { data: committed, error: lookupError } = await supabase.from('posts').select('id').eq('id', id).maybeSingle();
    if (committed) return;
    // Never delete the photo when commit status is unknown. RLS also protects published images.
    if (!lookupError) await supabase.storage.from('food-photos').remove([path]);
    throw error;
  }
}

export async function loadPost(id: string): Promise<FeedPost | null> {
  const { data, error } = await supabase.from('posts').select(POST_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: photo, error: photoError } = await supabase.storage.from('food-photos').createSignedUrl(data.photo_path, 3600);
  if (photoError) throw photoError;
  const [dish] = await loadDishes([data]);
  return { ...data, imageUrl: photo.signedUrl, dish };
}
