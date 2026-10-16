import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { isValidScore, loadAverage, loadMyRating, MAX_SCORE, MIN_SCORE, submitRating } from '../ratings';

// Replace the Supabase client with a fake whose responses each test controls.
// Query methods record their arguments in mockQueryCall; awaiting a list query resolves to mockListResult(),
// and awaiting an update resolves to mockUpdateResult().
type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockQueryCall = jest.fn<(method: string, ...args: unknown[]) => void>();
const mockInsert = jest.fn<AsyncCall>();
const mockMaybeSingle = jest.fn<AsyncCall>();
const mockListResult = jest.fn<AsyncCall>();
const mockUpdateResult = jest.fn<AsyncCall>();
const mockGetSession = jest.fn<AsyncCall>();
jest.mock('../supabase', () => {
  const record = (target: Record<string, unknown>, method: string) => (...args: unknown[]) => {
    mockQueryCall(method, ...args);
    return target;
  };
  const updateQuery: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockUpdateResult().then(resolve, reject),
  };
  updateQuery.eq = record(updateQuery, 'update.eq');
  const query: Record<string, unknown> = {
    insert: (...args: unknown[]) => mockInsert(...args),
    maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockListResult().then(resolve, reject),
  };
  query.select = record(query, 'select');
  query.eq = record(query, 'eq');
  query.update = record(updateQuery, 'update');
  return {
    supabase: {
      from: (table: string) => {
        mockQueryCall('from', table);
        return query;
      },
      auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
    },
  };
});
const queryCalls = (method: string) => mockQueryCall.mock.calls.filter(([name]) => name === method).map(([, ...args]) => args);

const signedIn = { data: { session: { user: { id: 'user-1' } } }, error: null };

beforeEach(() => {
  jest.resetAllMocks();
  mockInsert.mockResolvedValue({ error: null });
  mockUpdateResult.mockResolvedValue({ error: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockListResult.mockResolvedValue({ data: [], error: null });
  mockGetSession.mockResolvedValue(signedIn);
});

describe('isValidScore', () => {
  it('uses a 1-5 scale', () => {
    expect([MIN_SCORE, MAX_SCORE]).toEqual([1, 5]);
  });

  it.each([1, 2, 5])('accepts %p', (score) => {
    expect(isValidScore(score)).toBe(true);
  });

  it.each([0, 6, -1, 3.5, 4.999, NaN, Infinity])('rejects %p', (score) => {
    expect(isValidScore(score)).toBe(false);
  });
});

describe('submitRating', () => {
  it('rejects an invalid score without contacting the database', async () => {
    await expect(submitRating({ menuItemId: 'dish-1', score: 6 })).rejects.toThrow('Choose a score from 1 to 5.');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('inserts a new rating with only the dish and score', async () => {
    await expect(submitRating({ menuItemId: 'dish-1', score: 4 })).resolves.toBeUndefined();
    expect(queryCalls('from')).toEqual([['ratings']]);
    expect(mockInsert).toHaveBeenCalledWith({ menu_item_id: 'dish-1', score: 4 });
    expect(queryCalls('update')).toEqual([]);
  });

  it('updates the existing score when the member already rated the dish', async () => {
    mockInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    await expect(submitRating({ menuItemId: 'dish-1', score: 2 })).resolves.toBeUndefined();
    expect(queryCalls('update')).toEqual([[{ score: 2 }]]);
    expect(queryCalls('update.eq')).toEqual([['menu_item_id', 'dish-1']]);
  });

  it('surfaces other insert errors without updating', async () => {
    const denied = { code: '42501', message: 'permission denied' };
    mockInsert.mockResolvedValue({ error: denied });
    await expect(submitRating({ menuItemId: 'dish-1', score: 3 })).rejects.toBe(denied);
    expect(queryCalls('update')).toEqual([]);
  });

  it('surfaces errors from the update', async () => {
    const failed = { code: '08006', message: 'connection failure' };
    mockInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    mockUpdateResult.mockResolvedValue({ error: failed });
    await expect(submitRating({ menuItemId: 'dish-1', score: 3 })).rejects.toBe(failed);
  });
});

describe('loadMyRating', () => {
  it("returns the signed-in member's score for the dish", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { score: 3 }, error: null });
    await expect(loadMyRating('dish-1')).resolves.toBe(3);
    expect(queryCalls('eq')).toEqual([['menu_item_id', 'dish-1'], ['author_id', 'user-1']]);
  });

  it('returns null when the member has not rated the dish', async () => {
    await expect(loadMyRating('dish-1')).resolves.toBeNull();
  });

  it('returns null without querying when nobody is signed in', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(loadMyRating('dish-1')).resolves.toBeNull();
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('surfaces session errors', async () => {
    const failed = new Error('session unavailable');
    mockGetSession.mockResolvedValue({ data: { session: null }, error: failed });
    await expect(loadMyRating('dish-1')).rejects.toBe(failed);
  });

  it('surfaces query errors', async () => {
    const failed = { code: '08006', message: 'connection failure' };
    mockMaybeSingle.mockResolvedValue({ data: null, error: failed });
    await expect(loadMyRating('dish-1')).rejects.toBe(failed);
  });
});

describe('loadAverage', () => {
  it('reports no average when nobody has rated the dish', async () => {
    await expect(loadAverage('dish-1')).resolves.toEqual({ average: null, count: 0 });
    expect(queryCalls('eq')).toEqual([['menu_item_id', 'dish-1']]);
  });

  it('averages every score for the dish', async () => {
    mockListResult.mockResolvedValue({ data: [{ score: 2 }, { score: 5 }], error: null });
    await expect(loadAverage('dish-1')).resolves.toEqual({ average: 3.5, count: 2 });
  });

  it('handles a single rating', async () => {
    mockListResult.mockResolvedValue({ data: [{ score: 4 }], error: null });
    await expect(loadAverage('dish-1')).resolves.toEqual({ average: 4, count: 1 });
  });

  it('surfaces query errors', async () => {
    const failed = { code: '08006', message: 'connection failure' };
    mockListResult.mockResolvedValue({ data: null, error: failed });
    await expect(loadAverage('dish-1')).rejects.toBe(failed);
  });
});
