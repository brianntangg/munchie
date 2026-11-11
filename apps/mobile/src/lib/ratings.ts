import { supabase } from './supabase';

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

// Whole numbers 1–5. The rating screen uses this to enable Submit; the database enforces the same rule.
export function isValidScore(score: number): boolean {
  return Number.isInteger(score) && score >= MIN_SCORE && score <= MAX_SCORE;
}

// Saves the signed-in member's rating for a dish. Rating the same dish again replaces the old score.
export async function submitRating({ menuItemId, score }: { menuItemId: string; score: number }): Promise<void> {
  if (!isValidScore(score)) throw new Error(`Choose a score from ${MIN_SCORE} to ${MAX_SCORE}.`);
  const { error } = await supabase.from('ratings').insert({ menu_item_id: menuItemId, score });
  if (!error) return;
  // 23505: this member already rated the dish, so change their existing score instead.
  if (error.code !== '23505') throw error;
  // Row-level security limits updates to the member's own rating.
  const { error: updateError } = await supabase.from('ratings').update({ score }).eq('menu_item_id', menuItemId);
  if (updateError) throw updateError;
}

// The signed-in member's current score for a dish, or null if they have not rated it.
export async function loadMyRating(menuItemId: string): Promise<number | null> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) return null;
  const { data, error } = await supabase.from('ratings').select('score').eq('menu_item_id', menuItemId).eq('author_id', session.user.id).maybeSingle();
  if (error) throw error;
  return data?.score ?? null;
}

// Average score and number of ratings for a dish; the average is null when nobody has rated it.
// Reads every score for the dish, which is fine at campus scale.
export async function loadAverage(menuItemId: string): Promise<{ average: number | null; count: number }> {
  const { data, error } = await supabase.from('ratings').select('score').eq('menu_item_id', menuItemId);
  if (error) throw error;
  const count = data.length;
  const average = count ? data.reduce((sum, row) => sum + row.score, 0) / count : null;
  return { average, count };
}
