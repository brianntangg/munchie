import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { likePost, loadLikes, toggledLike, unlikePost } from '../likes';

// Replace the Supabase client with a chainable fake. Each query records its method calls; awaiting it resolves to
// mockRespond(query), so a test can answer each request by what it asked for.
type Query = { table: string; calls: unknown[][] };
type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockQueries: Query[] = [];
const mockRespond = jest.fn<(query: Query) => Promise<unknown>>();
const mockGetSession = jest.fn<AsyncCall>();
jest.mock('../supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    from: (table: string) => {
      const record: Query = { table, calls: [] };
      mockQueries.push(record);
      const query: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockRespond(record).then(resolve, reject),
      };
      for (const method of ['select', 'insert', 'delete', 'eq', 'in']) {
        query[method] = (...args: unknown[]) => {
          record.calls.push([method, ...args]);
          return query;
        };
      }
      return query;
    },
  },
}));
const callsOf = (query: Query, method: string) => query.calls.filter(([name]) => name === method).map(([, ...args]) => args);
const isCount = (query: Query) => callsOf(query, 'select').some(([, options]) => (options as { head?: boolean } | undefined)?.head === true);
const postOf = (query: Query) => callsOf(query, 'eq').find(([column]) => column === 'post_id')?.[1] as string;

const failed = { code: '08006', message: 'connection failure' };
const signedIn = { data: { session: { user: { id: 'me' } } }, error: null };

beforeEach(() => {
  jest.resetAllMocks();
  mockQueries.length = 0;
  mockRespond.mockResolvedValue({ data: [], error: null });
  mockGetSession.mockResolvedValue(signedIn);
});

describe('likePost', () => {
  it('inserts a like with only the post id', async () => {
    await expect(likePost('post-1')).resolves.toBeUndefined();
    expect(mockQueries.map((query) => query.table)).toEqual(['likes']);
    expect(callsOf(mockQueries[0], 'insert')).toEqual([[{ post_id: 'post-1' }]]);
  });

  it('treats liking an already-liked post as success', async () => {
    mockRespond.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    await expect(likePost('post-1')).resolves.toBeUndefined();
  });

  it('surfaces other errors', async () => {
    mockRespond.mockResolvedValue({ error: failed });
    await expect(likePost('post-1')).rejects.toBe(failed);
  });
});

describe('unlikePost', () => {
  it("deletes only the signed-in member's own like on that post", async () => {
    mockRespond.mockResolvedValue({ error: null });
    await expect(unlikePost('post-1')).resolves.toBeUndefined();
    expect(callsOf(mockQueries[0], 'delete')).toEqual([[]]);
    expect(callsOf(mockQueries[0], 'eq')).toEqual([['post_id', 'post-1'], ['author_id', 'me']]);
  });

  it('asks the member to sign in, without deleting anything, when nobody is signed in', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(unlikePost('post-1')).rejects.toThrow('Sign in to like posts.');
    expect(mockQueries).toEqual([]);
  });

  it('surfaces session errors', async () => {
    const sessionError = new Error('session unavailable');
    mockGetSession.mockResolvedValue({ data: { session: null }, error: sessionError });
    await expect(unlikePost('post-1')).rejects.toBe(sessionError);
  });

  it('surfaces delete errors', async () => {
    mockRespond.mockResolvedValue({ error: failed });
    await expect(unlikePost('post-1')).rejects.toBe(failed);
  });
});

describe('loadLikes', () => {
  const counts: Record<string, number> = { 'post-1': 2, 'post-2': 1, 'post-3': 0 };
  beforeEach(() => {
    mockRespond.mockImplementation(async (query) => (isCount(query)
      ? { count: counts[postOf(query)], error: null }
      : { data: [{ post_id: 'post-1' }], error: null }));
  });

  it('returns nothing without querying when there are no posts', async () => {
    await expect(loadLikes([], 'me')).resolves.toEqual({});
    expect(mockQueries).toEqual([]);
  });

  it("counts each post's likes and marks the ones the viewer liked", async () => {
    await expect(loadLikes(['post-1', 'post-2', 'post-3'], 'me')).resolves.toEqual({
      'post-1': { count: 2, likedByMe: true },
      'post-2': { count: 1, likedByMe: false },
      'post-3': { count: 0, likedByMe: false },
    });
  });

  it('counts without downloading like rows, one count per post', async () => {
    await loadLikes(['post-1', 'post-2'], 'me');
    const countQueries = mockQueries.filter(isCount);
    expect(countQueries.map(postOf)).toEqual(['post-1', 'post-2']);
    for (const query of countQueries) expect(callsOf(query, 'select')).toEqual([['*', { count: 'exact', head: true }]]);
  });

  it("looks up only the viewer's own likes for these posts", async () => {
    await loadLikes(['post-1', 'post-2'], 'me');
    const [viewerQuery] = mockQueries.filter((query) => !isCount(query));
    expect(callsOf(viewerQuery, 'select')).toEqual([['post_id']]);
    expect(callsOf(viewerQuery, 'eq')).toEqual([['author_id', 'me']]);
    expect(callsOf(viewerQuery, 'in')).toEqual([['post_id', ['post-1', 'post-2']]]);
  });

  it('reports counts past the 1,000-row API limit exactly', async () => {
    counts['post-1'] = 1001;
    try {
      await expect(loadLikes(['post-1'], 'me')).resolves.toEqual({ 'post-1': { count: 1001, likedByMe: true } });
    } finally {
      counts['post-1'] = 2;
    }
  });

  it('asks about each post once, even if it appears twice', async () => {
    await loadLikes(['post-1', 'post-1'], 'me');
    expect(mockQueries.filter(isCount)).toHaveLength(1);
  });

  it('marks nothing as liked, without looking up likes, when there is no viewer', async () => {
    await expect(loadLikes(['post-1'], null)).resolves.toEqual({ 'post-1': { count: 2, likedByMe: false } });
    expect(mockQueries.filter((query) => !isCount(query))).toEqual([]);
  });

  it('treats a missing count as zero', async () => {
    mockRespond.mockImplementation(async (query) => (isCount(query) ? { count: null, error: null } : { data: [], error: null }));
    await expect(loadLikes(['post-1'], 'me')).resolves.toEqual({ 'post-1': { count: 0, likedByMe: false } });
  });

  it('surfaces count errors', async () => {
    mockRespond.mockImplementation(async (query) => (isCount(query) ? { count: null, error: failed } : { data: [], error: null }));
    await expect(loadLikes(['post-1'], 'me')).rejects.toBe(failed);
  });

  it("surfaces errors looking up the viewer's likes", async () => {
    mockRespond.mockImplementation(async (query) => (isCount(query) ? { count: 1, error: null } : { data: null, error: failed }));
    await expect(loadLikes(['post-1'], 'me')).rejects.toBe(failed);
  });
});

describe('toggledLike', () => {
  it('adds a like and fills the heart', () => {
    expect(toggledLike({ count: 2, likedByMe: false })).toEqual({ count: 3, likedByMe: true });
  });

  it('removes a like and empties the heart', () => {
    expect(toggledLike({ count: 3, likedByMe: true })).toEqual({ count: 2, likedByMe: false });
  });

  it('never shows a negative count', () => {
    expect(toggledLike({ count: 0, likedByMe: true })).toEqual({ count: 0, likedByMe: false });
  });
});
