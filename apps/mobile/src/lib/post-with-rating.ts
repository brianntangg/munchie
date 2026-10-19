import { publishPost } from './posts';
import { isValidScore, submitRating } from './ratings';

export type MealRating = { menuItemId: string; score: number };
export type PostWithRatingInput = {
  postId: string;
  userId: string;
  hallId: string;
  caption: string;
  base64: string;
  rating?: MealRating;
  // True when the post was published on an earlier attempt and only its rating still needs saving.
  alreadyPosted?: boolean;
};

// Publishes the post, then saves its rating. A failed publish throws, so the draft can simply be retried.
// A failed rating does not throw: the meal is already posted, so it comes back as `ratingError` and the caller
// retries with `alreadyPosted` set, which never creates a second post. `ratingError` is null when everything saved.
export async function postWithRating({ postId, userId, hallId, caption, base64, rating, alreadyPosted = false }: PostWithRatingInput): Promise<{ ratingError: unknown }> {
  // Checked up front so a bad score cannot leave a posted meal behind.
  if (rating && !isValidScore(rating.score)) throw new Error('Choose a score from 1 to 5.');
  if (!alreadyPosted) await publishPost({ id: postId, userId, hallId, menuItemId: rating?.menuItemId, caption, base64 });
  if (!rating) return { ratingError: null };
  try {
    await submitRating(rating);
  } catch (ratingError) {
    return { ratingError };
  }
  return { ratingError: null };
}

// Whether the post form can be submitted. Once the meal is posted only its rating is left, so photo and hall no longer matter.
export function canPost({ posted, hasPhoto, hallId, hasDish, score }: { posted: boolean; hasPhoto: boolean; hallId: string; hasDish: boolean; score: number | null }): boolean {
  if (!posted && (!hasPhoto || !hallId)) return false;
  return !hasDish || score !== null;
}

export function postLabel({ busy, posted, hasDish }: { busy: boolean; posted: boolean; hasDish: boolean }): string {
  if (busy) return 'Please wait…';
  if (posted) return 'Save rating';
  return hasDish ? 'Post meal and rating' : 'Post meal';
}
