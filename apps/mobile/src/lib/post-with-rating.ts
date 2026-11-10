import { publishPost, type PostPhotoInput } from './posts';
import { isValidScore, submitRating } from './ratings';

export type MealRating = { menuItemId: string; score: number };
export type PostWithRatingInput = {
  postId: string;
  userId: string;
  hallId: string;
  caption: string;
  photos: PostPhotoInput[];
  ratings?: MealRating[];
  // True when the post was published on an earlier attempt and only its ratings still need saving.
  alreadyPosted?: boolean;
  // True when the post was saved on an earlier attempt but its extra photos were not attached (PhotosNotAttachedError).
  // The retry finishes attaching them, which never creates a second post, before saving the ratings.
  photosPending?: boolean;
};

// Publishes the post, then saves the rating of each dish the member scored. A failed publish throws, so the draft can simply be retried.
// A failed rating does not throw: the meal is already posted, so the first failure comes back as `ratingError` and the caller
// retries with `alreadyPosted` set, which never creates a second post. Every rating is attempted, and saving one again is harmless.
// `ratingError` is null when everything saved.
export async function postWithRating({ postId, userId, hallId, caption, photos, ratings = [], alreadyPosted = false, photosPending = false }: PostWithRatingInput): Promise<{ ratingError: unknown }> {
  // Checked up front so a bad score cannot leave a posted meal behind.
  if (ratings.some((rating) => !isValidScore(rating.score))) throw new Error('Choose a score from 1 to 5.');
  if (!alreadyPosted || photosPending) await publishPost({ id: postId, userId, hallId, caption, photos });
  let ratingError: unknown = null;
  for (const rating of ratings) {
    try {
      await submitRating(rating);
    } catch (error) {
      ratingError ??= error;
    }
  }
  return { ratingError };
}

// Whether the post form can be submitted. Once the meal is posted only its ratings are left, so photos and hall no longer matter.
export function canPost({ posted, photoCount, hallId }: { posted: boolean; photoCount: number; hallId: string }): boolean {
  return posted || (photoCount > 0 && !!hallId);
}

export function postLabel({ busy, posted, photosPending = false, ratingCount }: { busy: boolean; posted: boolean; photosPending?: boolean; ratingCount: number }): string {
  if (busy) return 'Please wait…';
  if (photosPending) return 'Attach the other photos';
  const ratings = ratingCount === 1 ? 'rating' : 'ratings';
  if (posted) return `Save ${ratings}`;
  return ratingCount ? `Post meal and ${ratings}` : 'Post meal';
}
