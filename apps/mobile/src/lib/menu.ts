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
