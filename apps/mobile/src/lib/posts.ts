import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import type { Tables } from './database.types';
import { isValidScore } from './ratings';

// `dish` is what the photo shows: a menu item or free text the author typed, with the score they gave it when posting
// (null if they did not). The score is fixed with the post, so rating the dish again later does not change older posts.
export type FeedPhoto = { id: string; imageUrl: string | null; dish: { name: string; score: number | null } | null };
// `photos` are in display order; the first is the cover.
export type FeedPost = Tables<'posts'> & { profiles: { display_name: string }; dining_halls: { name: string }; photos: FeedPhoto[] };
export const PAGE_SIZE = 20;
// The database enforces the same limit on a post's photo slots.
export const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const POST_COLUMNS = '*, profiles!inner(display_name), dining_halls!inner(name), post_photos(id, slot, photo_path, menu_item_id, menu_item_score, dish_text, dish_text_score, menu_items(name))';
type PhotoRow = Pick<Tables<'post_photos'>, 'id' | 'slot' | 'photo_path' | 'menu_item_id' | 'menu_item_score' | 'dish_text' | 'dish_text_score'> & { menu_items: { name: string } | null };
type PostRow = Tables<'posts'> & { profiles: { display_name: string }; dining_halls: { name: string }; post_photos: PhotoRow[] };

async function toFeedPosts(rows: PostRow[]): Promise<FeedPost[]> {
  const ordered = rows.map((row) => [...row.post_photos].sort((a, b) => a.slot - b.slot));
  const paths = ordered.flatMap((photos) => photos.map((photo) => photo.photo_path));
  let urls: { signedUrl: string | null }[] = [];
  if (paths.length) {
    const { data, error } = await supabase.storage.from('food-photos').createSignedUrls(paths, 3600);
    if (error) throw error;
    urls = data;
  }
  let next = 0;
  return rows.map(({ post_photos: _photos, ...post }, index) => ({
    ...post,
    photos: ordered[index].map((photo) => ({
      id: photo.id,
      imageUrl: urls[next++]?.signedUrl || null,
      dish: photo.menu_item_id && photo.menu_items ? { name: photo.menu_items.name, score: photo.menu_item_score } : photo.dish_text ? { name: photo.dish_text, score: photo.dish_text_score } : null,
    })),
  }));
}
export async function loadPosts(cursor?: { created_at: string; id: string }, filters?: { hallId?: string; authorId?: string; authorIds?: string[] }): Promise<FeedPost[]> {
  let query = supabase.from('posts').select(POST_COLUMNS).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE);
  if (filters?.hallId) query = query.eq('dining_hall_id', filters.hallId);
  if (filters?.authorId) query = query.eq('author_id', filters.authorId);
  if (filters?.authorIds) {
    if (!filters.authorIds.length) return [];
    query = query.in('author_id', filters.authorIds);
  }
  if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const { data, error } = await query;
  if (error) throw error;
  if (!data.length) return [];
  return toFeedPosts(data);
}

// The first photo is the post's cover and is stored under the post's id; its own `id` is not used.
// Every other photo needs a stable `id` so a retry never uploads or attaches it twice.
// A photo names a menu dish (`menuItemId`) or free text (`dishText`), not both, with an optional score for it
// (`menuItemScore` or `dishTextScore`) that is saved with the photo. A menu dish's score is also saved as the member's
// rating (see post-with-rating), which feeds the dish's average; free text has no menu item, so it never counts there.
export type PostPhotoInput = { id: string; base64: string; menuItemId?: string; menuItemScore?: number; dishText?: string; dishTextScore?: number };
export const MAX_DISH_TEXT = 100;

// Only the dish columns a photo actually uses are sent, so an unlabeled photo stays null in both.
const dishColumns = ({ menuItemId, menuItemScore, dishText, dishTextScore }: PostPhotoInput) => ({
  ...(menuItemId ? { menu_item_id: menuItemId } : {}),
  ...(menuItemId && menuItemScore !== undefined ? { menu_item_score: menuItemScore } : {}),
  ...(dishText ? { dish_text: dishText.trim() } : {}),
  ...(dishText && dishTextScore !== undefined ? { dish_text_score: dishTextScore } : {}),
});

// Thrown once the post itself is saved but its extra photos could not be attached. The post is already live,
// so the caller must not change the photos, hall or labels: retrying the same submission only finishes attaching.
export class PhotosNotAttachedError extends Error {
  constructor(readonly attachError: unknown) {
    super('Your meal was posted, but the other photos were not attached.');
    this.name = 'PhotosNotAttachedError';
  }
}

// Stable IDs make retrying an interrupted submission safe. A retry after the post was saved only finishes attaching the extra photos.
export async function publishPost({ id, userId, hallId, caption, photos }: { id: string; userId: string; hallId: string; caption: string; photos: PostPhotoInput[] }) {
  if (!photos.length) throw new Error('Add a photo to share your meal.');
  if (photos.length > MAX_PHOTOS) throw new Error(`Share up to ${MAX_PHOTOS} photos per meal.`);
  const dishes = photos.flatMap((photo) => (photo.menuItemId ? [photo.menuItemId] : []));
  if (new Set(dishes).size !== dishes.length) throw new Error('Tag each dish on only one photo.');
  if (photos.some((photo) => photo.menuItemId && photo.dishText)) throw new Error('Name a menu dish or type your own, not both.');
  if (photos.some((photo) => photo.dishText !== undefined && !(photo.dishText.trim().length >= 1 && photo.dishText.trim().length <= MAX_DISH_TEXT))) throw new Error(`Describe each photo in 1 to ${MAX_DISH_TEXT} characters.`);
  if (photos.some((photo) => photo.dishTextScore !== undefined && photo.dishText === undefined)) throw new Error('Only a labeled photo can be rated.');
  if (photos.some((photo) => photo.menuItemScore !== undefined && photo.menuItemId === undefined)) throw new Error('Only a labeled photo can be rated.');
  if (photos.some((photo) => [photo.dishTextScore, photo.menuItemScore].some((score) => score !== undefined && !isValidScore(score)))) throw new Error('Choose a score from 1 to 5.');
  const { data: existing, error: checkError } = await supabase.from('posts').select('id, author_id').eq('id', id).maybeSingle();
  if (checkError) throw checkError;
  if (existing && existing.author_id !== userId) throw new Error('This post belongs to another member.');
  const files = photos.map((photo, index) => {
    const bytes = decode(photo.base64);
    if (bytes.byteLength > MAX_PHOTO_BYTES) throw new Error('Choose a smaller photo (maximum 5 MB).');
    return { photo, bytes, path: `${userId}/${index === 0 ? id : photo.id}.jpg` };
  });
  const [cover, ...extras] = files;
  for (const file of existing ? extras : files) {
    const { error: uploadError } = await supabase.storage.from('food-photos').upload(file.path, file.bytes, { contentType: 'image/jpeg', upsert: false });
    // A previous attempt may have uploaded the photo before losing connectivity.
    if (uploadError && !('statusCode' in uploadError && String(uploadError.statusCode) === '409')) throw uploadError;
  }
  if (!existing) {
    const { error } = await supabase.from('posts').insert({ id, author_id: userId, dining_hall_id: hallId, ...dishColumns(cover.photo), caption: caption.trim(), photo_path: cover.path });
    if (error) {
      // Only this member's own post counts as saved, so an id that belongs to someone else is never treated as a success (review of #56).
      const { data: committed, error: lookupError } = await supabase.from('posts').select('id').eq('id', id).eq('author_id', userId).maybeSingle();
      if (!committed) {
        // Never delete the photos when commit status is unknown. RLS also protects published images.
        if (!lookupError) await supabase.storage.from('food-photos').remove(files.map((file) => file.path));
        throw error;
      }
    }
  }
  if (!extras.length) return;
  // One request, so the extra photos are all attached or none are; ignoring duplicates makes a retry harmless.
  const { error: attachError } = await supabase.from('post_photos').upsert(
    extras.map((file, index) => ({ id: file.photo.id, post_id: id, dining_hall_id: hallId, slot: index + 1, photo_path: file.path, ...dishColumns(file.photo) })),
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (attachError) throw new PhotosNotAttachedError(attachError);
}

export async function loadPost(id: string): Promise<FeedPost | null> {
  const { data, error } = await supabase.from('posts').select(POST_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [post] = await toFeedPosts([data]);
  return post;
}
