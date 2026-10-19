import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { canShare, shareLabel, shareMeal } from '../share-meal';

// shareMeal only sequences publishPost and submitRating, so both are replaced; the real score check is kept.
type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockPublish = jest.fn<AsyncCall>();
const mockRate = jest.fn<AsyncCall>();
jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('../posts', () => ({ publishPost: (...args: unknown[]) => mockPublish(...args) }));
jest.mock('../ratings', () => ({ ...jest.requireActual<object>('../ratings'), submitRating: (...args: unknown[]) => mockRate(...args) }));

const meal = { postId: 'post-1', userId: 'user-1', hallId: 'hall-1', caption: 'Great pasta', base64: 'abc' };
const rating = { menuItemId: 'dish-1', score: 4 };

beforeEach(() => {
  jest.resetAllMocks();
  mockPublish.mockResolvedValue(undefined);
  mockRate.mockResolvedValue(undefined);
});

describe('shareMeal', () => {
  it('publishes the post with its dish, then saves the rating', async () => {
    await expect(shareMeal({ ...meal, rating })).resolves.toEqual({ ratingError: null });
    expect(mockPublish).toHaveBeenCalledWith({ id: 'post-1', userId: 'user-1', hallId: 'hall-1', menuItemId: 'dish-1', caption: 'Great pasta', base64: 'abc' });
    expect(mockRate).toHaveBeenCalledWith(rating);
    expect(mockPublish.mock.invocationCallOrder[0]).toBeLessThan(mockRate.mock.invocationCallOrder[0]);
  });

  it('posts a plain meal with no dish and no rating', async () => {
    await expect(shareMeal(meal)).resolves.toEqual({ ratingError: null });
    expect(mockPublish).toHaveBeenCalledWith({ id: 'post-1', userId: 'user-1', hallId: 'hall-1', menuItemId: undefined, caption: 'Great pasta', base64: 'abc' });
    expect(mockRate).not.toHaveBeenCalled();
  });

  it('throws when publishing fails, without rating, so the draft can be retried', async () => {
    const failure = new Error('network down');
    mockPublish.mockRejectedValue(failure);
    await expect(shareMeal({ ...meal, rating })).rejects.toBe(failure);
    expect(mockRate).not.toHaveBeenCalled();
  });

  it('reports a failed rating instead of throwing, because the meal is already posted', async () => {
    const failure = new Error('rating rejected');
    mockRate.mockRejectedValue(failure);
    await expect(shareMeal({ ...meal, rating })).resolves.toEqual({ ratingError: failure });
    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('retries only the rating once the meal is posted, never creating a second post', async () => {
    await expect(shareMeal({ ...meal, rating, alreadyPosted: true })).resolves.toEqual({ ratingError: null });
    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockRate).toHaveBeenCalledWith(rating);
  });

  it('can fail the rating again on a retry, and still does not repost', async () => {
    const failure = new Error('still failing');
    mockRate.mockRejectedValue(failure);
    await expect(shareMeal({ ...meal, rating, alreadyPosted: true })).resolves.toEqual({ ratingError: failure });
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it.each([0, 6, 3.5, NaN])('rejects the score %p before anything is posted', async (score) => {
    await expect(shareMeal({ ...meal, rating: { ...rating, score } })).rejects.toThrow('Choose a score from 1 to 5.');
    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockRate).not.toHaveBeenCalled();
  });
});

describe('canShare', () => {
  const ready = { posted: false, hasPhoto: true, hallId: 'hall-1', hasDish: false, score: null };

  it('needs a photo and a hall before the meal is posted', () => {
    expect(canShare(ready)).toBe(true);
    expect(canShare({ ...ready, hasPhoto: false })).toBe(false);
    expect(canShare({ ...ready, hallId: '' })).toBe(false);
  });

  it('needs a score once a dish is chosen', () => {
    expect(canShare({ ...ready, hasDish: true })).toBe(false);
    expect(canShare({ ...ready, hasDish: true, score: 5 })).toBe(true);
  });

  it('only needs the score after the meal is posted, whatever happened to the photo and hall', () => {
    const posted = { posted: true, hasPhoto: false, hallId: '', hasDish: true, score: null };
    expect(canShare(posted)).toBe(false);
    expect(canShare({ ...posted, score: 2 })).toBe(true);
  });
});

describe('shareLabel', () => {
  it.each([
    [{ busy: true, posted: false, hasDish: false }, 'Please wait…'],
    [{ busy: true, posted: true, hasDish: true }, 'Please wait…'],
    [{ busy: false, posted: true, hasDish: true }, 'Save rating'],
    [{ busy: false, posted: false, hasDish: true }, 'Post meal and rating'],
    [{ busy: false, posted: false, hasDish: false }, 'Post meal'],
  ])('%j reads %p', (state, label) => {
    expect(shareLabel(state)).toBe(label);
  });
});
