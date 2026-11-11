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
  // Name the member's own row as well as relying on row-level security, so a policy change could never let
  // this rewrite other members' scores (review of #56).
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error('Sign in to rate this dish.');
  const { error: updateError } = await supabase.from('ratings').update({ score }).eq('menu_item_id', menuItemId).eq('author_id', session.user.id);
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

// The API returns at most this many rows per request (max_rows in supabase/config.toml).
const PAGE_ROWS = 1000;

// Average score and number of ratings for a dish; the average is null when nobody has rated it.
// Reads every score page by page, ordered by id so no rating is counted twice or skipped (review of #56).
export async function loadAverage(menuItemId: string): Promise<{ average: number | null; count: number }> {
  let sum = 0;
  let count = 0;
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await supabase.from('ratings').select('score').eq('menu_item_id', menuItemId).order('id').range(from, from + PAGE_ROWS - 1);
    if (error) throw error;
    for (const row of data) sum += row.score;
    count += data.length;
    if (data.length < PAGE_ROWS) break;
  }
  return { average: count ? sum / count : null, count };
}
