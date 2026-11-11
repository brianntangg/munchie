import { supabase } from './supabase';
import type { Tables } from './database.types';

export type MenuItem = Pick<Tables<'menu_items'>, 'id' | 'name' | 'category'>;

// A hall's dishes, ordered by station then name so an unfiltered list groups cleanly.
export async function loadMenuItems(hallId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase.from('menu_items').select('id, name, category').eq('dining_hall_id', hallId).order('category').order('name');
  if (error) throw error;
  return data;
}

export const SUGGESTION_COUNT = 3;

// How well a dish fits what the member typed: 0 name starts with it, 1 a word in the name starts with it, 2 name contains it, 3 only the station does.
function fit(item: MenuItem, needle: string): number {
  const name = item.name.toLowerCase();
  if (name.startsWith(needle)) return 0;
  if (name.split(/[^a-z0-9]+/).some((word) => word.startsWith(needle))) return 1;
  return name.includes(needle) ? 2 : 3;
}

// The few best matches for what the member typed, so the photo screen can offer quick taps instead of a long list.
// Better fits come first and ties keep menu order. `total` is how many dishes matched, so the screen can say when more are hidden.
// Nothing typed yet means nothing to suggest.
export function suggestDishes(items: MenuItem[], query: string, limit = SUGGESTION_COUNT): { shown: MenuItem[]; total: number } {
  const needle = query.trim().toLowerCase();
  if (!needle) return { shown: [], total: 0 };
  const matches = items
    .filter((item) => `${item.name} ${item.category ?? ''}`.toLowerCase().includes(needle))
    .map((item, order) => ({ item, order, rank: fit(item, needle) }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order);
  return { shown: matches.slice(0, limit).map(({ item }) => item), total: matches.length };
}

// How many popular dishes to fetch for a hall. More than are shown, because dishes already chosen for other photos of the post are skipped.
export const POPULAR_FETCH = 8;

// A hall's most-rated dishes, ranked by the database so the app never downloads ratings to count them.
export async function loadPopularDishes(hallId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase.rpc('popular_dishes', { hall_id: hallId, max_results: POPULAR_FETCH });
  if (error) throw error;
  return data;
}

// The few dishes to offer before anything is typed, so there is always something to tap: the first of `popular` that
// are still `available`, or, when none are (a hall nobody has rated yet), the first dishes on its menu. `popular` says
// which, so the screen only calls a list popular when it is.
export function starterDishes(popular: MenuItem[], available: MenuItem[], limit = SUGGESTION_COUNT): { shown: MenuItem[]; popular: boolean } {
  const open = new Set(available.map((item) => item.id));
  const rated = popular.filter((item) => open.has(item.id)).slice(0, limit);
  return rated.length ? { shown: rated, popular: true } : { shown: available.slice(0, limit), popular: false };
}

const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

// The menu dish named exactly what the member typed (ignoring case and spacing), or null when none or several are.
export function exactDish(items: MenuItem[], text: string): MenuItem | null {
  const typed = normalize(text);
  if (!typed) return null;
  const matches = items.filter((item) => normalize(item.name) === typed);
  return matches.length === 1 ? matches[0] : null;
}

// Typing a dish's exact menu name without tapping the suggestion should still count as that dish, so its rating feeds the
// dish's average instead of being kept as free text. Each typed label that names a menu dish not already tagged on another
// photo becomes that dish, keeping its score. Photos are checked in order, so the first photo to name a dish gets it.
export function labelTypedDishes<T extends { dish: MenuItem | null; text: string }>(photos: T[], items: MenuItem[]): T[] {
  const taken = new Set(photos.flatMap((photo) => (photo.dish ? [photo.dish.id] : [])));
  return photos.map((photo) => {
    if (photo.dish) return photo;
    const match = exactDish(items.filter((item) => !taken.has(item.id)), photo.text);
    if (!match) return photo;
    taken.add(match.id);
    return { ...photo, dish: match, text: '' };
  });
}
