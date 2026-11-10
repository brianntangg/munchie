import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { canPost, postLabel, postWithRating } from '../post-with-rating';

// postWithRating only sequences publishPost and submitRating, so both are replaced; the real score check is kept.
type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockPublish = jest.fn<AsyncCall>();
const mockRate = jest.fn<AsyncCall>();
jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('../posts', () => ({ publishPost: (...args: unknown[]) => mockPublish(...args) }));
jest.mock('../ratings', () => ({ ...jest.requireActual<object>('../ratings'), submitRating: (...args: unknown[]) => mockRate(...args) }));

const photos = [{ id: 'photo-0', base64: 'abc', menuItemId: 'dish-1' }, { id: 'photo-1', base64: 'def', menuItemId: 'dish-2' }];
const meal = { postId: 'post-1', userId: 'user-1', hallId: 'hall-1', caption: 'Great pasta', photos };
const published = { id: 'post-1', userId: 'user-1', hallId: 'hall-1', caption: 'Great pasta', photos };
const rating = { menuItemId: 'dish-1', score: 4 };
const otherRating = { menuItemId: 'dish-2', score: 2 };

beforeEach(() => {
  jest.resetAllMocks();
  mockPublish.mockResolvedValue(undefined);
  mockRate.mockResolvedValue(undefined);
});

describe('postWithRating', () => {
  it('publishes the post with its photos, then saves each rating', async () => {
    await expect(postWithRating({ ...meal, ratings: [rating, otherRating] })).resolves.toEqual({ ratingError: null });
    expect(mockPublish).toHaveBeenCalledWith(published);
    expect(mockRate.mock.calls).toEqual([[rating], [otherRating]]);
    expect(mockPublish.mock.invocationCallOrder[0]).toBeLessThan(mockRate.mock.invocationCallOrder[0]);
  });

  it('posts a meal with tagged dishes but no ratings without rating anything', async () => {
    await expect(postWithRating(meal)).resolves.toEqual({ ratingError: null });
    expect(mockPublish).toHaveBeenCalledWith(published);
    expect(mockRate).not.toHaveBeenCalled();
  });

  it('rates only the dishes the member scored', async () => {
    await postWithRating({ ...meal, ratings: [otherRating] });
    expect(mockRate.mock.calls).toEqual([[otherRating]]);
  });

  it('throws when publishing fails, without rating, so the draft can be retried', async () => {
    const failure = new Error('network down');
    mockPublish.mockRejectedValue(failure);
    await expect(postWithRating({ ...meal, ratings: [rating] })).rejects.toBe(failure);
    expect(mockRate).not.toHaveBeenCalled();
  });

  it('reports a failed rating instead of throwing, because the meal is already posted', async () => {
    const failure = new Error('rating rejected');
    mockRate.mockRejectedValue(failure);
    await expect(postWithRating({ ...meal, ratings: [rating] })).resolves.toEqual({ ratingError: failure });
    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('still saves the other ratings when one fails, and reports the first failure', async () => {
    const first = new Error('first rejected');
    mockRate.mockRejectedValueOnce(first).mockRejectedValueOnce(new Error('second rejected'));
    await expect(postWithRating({ ...meal, ratings: [rating, otherRating, { menuItemId: 'dish-3', score: 5 }] })).resolves.toEqual({ ratingError: first });
    expect(mockRate).toHaveBeenCalledTimes(3);
  });

  it('retries only the ratings once the meal is posted, never creating a second post', async () => {
    await expect(postWithRating({ ...meal, ratings: [rating], alreadyPosted: true })).resolves.toEqual({ ratingError: null });
    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockRate).toHaveBeenCalledWith(rating);
  });

  it('finishes attaching the photos before rating when the post was saved without them', async () => {
    await expect(postWithRating({ ...meal, ratings: [rating], alreadyPosted: true, photosPending: true })).resolves.toEqual({ ratingError: null });
    expect(mockPublish).toHaveBeenCalledWith(published);
    expect(mockRate).toHaveBeenCalledWith(rating);
    expect(mockPublish.mock.invocationCallOrder[0]).toBeLessThan(mockRate.mock.invocationCallOrder[0]);
  });

  it('can fail a rating again on a retry, and still does not repost', async () => {
    const failure = new Error('still failing');
    mockRate.mockRejectedValue(failure);
    await expect(postWithRating({ ...meal, ratings: [rating], alreadyPosted: true })).resolves.toEqual({ ratingError: failure });
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it.each([0, 6, 3.5, NaN])('rejects the score %p before anything is posted', async (score) => {
    await expect(postWithRating({ ...meal, ratings: [otherRating, { ...rating, score }] })).rejects.toThrow('Choose a score from 1 to 5.');
    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockRate).not.toHaveBeenCalled();
  });
});

describe('canPost', () => {
  const ready = { posted: false, photoCount: 1, hallId: 'hall-1' };

  it('needs at least one photo and a hall before the meal is posted', () => {
    expect(canPost(ready)).toBe(true);
    expect(canPost({ ...ready, photoCount: 3 })).toBe(true);
    expect(canPost({ ...ready, photoCount: 0 })).toBe(false);
    expect(canPost({ ...ready, hallId: '' })).toBe(false);
  });

  it('can always retry once the meal is posted, whatever happened to the photos and hall', () => {
    expect(canPost({ posted: true, photoCount: 0, hallId: '' })).toBe(true);
  });
});

describe('postLabel', () => {
  it.each([
    [{ busy: true, posted: false, ratingCount: 0 }, 'Please wait…'],
    [{ busy: true, posted: true, ratingCount: 2 }, 'Please wait…'],
    [{ busy: false, posted: true, ratingCount: 1 }, 'Save rating'],
    [{ busy: false, posted: true, ratingCount: 2 }, 'Save ratings'],
    [{ busy: false, posted: false, ratingCount: 1 }, 'Post meal and rating'],
    [{ busy: false, posted: false, ratingCount: 3 }, 'Post meal and ratings'],
    [{ busy: false, posted: false, ratingCount: 0 }, 'Post meal'],
    [{ busy: false, posted: true, photosPending: true, ratingCount: 2 }, 'Attach the other photos'],
    [{ busy: true, posted: true, photosPending: true, ratingCount: 0 }, 'Please wait…'],
  ])('%j reads %p', (state, label) => {
    expect(postLabel(state)).toBe(label);
  });
});
