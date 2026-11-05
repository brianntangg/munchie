import { supabase } from './supabase';
import type { Tables } from './database.types';

export type MenuItem = Pick<Tables<'menu_items'>, 'id' | 'name' | 'category'>;

// A hall's dishes, ordered by station then name so an unfiltered list groups cleanly.
export async function loadMenuItems(hallId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase.from('menu_items').select('id, name, category').eq('dining_hall_id', hallId).order('category').order('name');
  if (error) throw error;
  return data;
}

export const DISH_RESULTS = 8;

// Dishes whose name or station contains the search text (ignoring case), capped so a hall with hundreds of dishes stays usable.
// `total` is how many matched before the cap, so the screen can say when more are hidden.
export function filterDishes(items: MenuItem[], query: string, limit = DISH_RESULTS): { shown: MenuItem[]; total: number } {
  const needle = query.trim().toLowerCase();
  const matches = needle ? items.filter((item) => `${item.name} ${item.category ?? ''}`.toLowerCase().includes(needle)) : items;
  return { shown: matches.slice(0, limit), total: matches.length };
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

// The few popular dishes to offer before anything is typed: the first of `popular` that are still `available`.
export function starterDishes(popular: MenuItem[], available: MenuItem[], limit = SUGGESTION_COUNT): MenuItem[] {
  const open = new Set(available.map((item) => item.id));
  return popular.filter((item) => open.has(item.id)).slice(0, limit);
}
