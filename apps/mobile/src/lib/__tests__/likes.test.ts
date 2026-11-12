import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { likePost, loadLikes, unlikePost } from '../likes';

// Replace the Supabase client with a chainable fake. Every query method records its arguments in mockCall;
// awaiting a query resolves to mockResult(kind), where kind is 'insert', 'delete', or 'select'.
type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockCall = jest.fn<(method: string, ...args: unknown[]) => void>();
const mockResult = jest.fn<(kind: string) => Promise<unknown>>();
const mockGetSession = jest.fn<AsyncCall>();
jest.mock('../supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    from: (table: string) => {
      mockCall('from', table);
      let kind = 'select';
      const query: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockResult(kind).then(resolve, reject),
      };
      for (const method of ['select', 'insert', 'delete', 'eq', 'in']) {
        query[method] = (...args: unknown[]) => {
          mockCall(method, ...args);
          if (method === 'insert' || method === 'delete') kind = method;
          return query;
        };
      }
      return query;
    },
  },
}));
const calls = (method: string) => mockCall.mock.calls.filter(([name]) => name === method).map(([, ...args]) => args);

const failed = { code: '08006', message: 'connection failure' };

beforeEach(() => {
  jest.resetAllMocks();
  mockResult.mockResolvedValue({ data: [], error: null });
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'me' } } }, error: null });
});

describe('likePost', () => {
  it('inserts a like with only the post id', async () => {
    await expect(likePost('post-1')).resolves.toBeUndefined();
    expect(calls('from')).toEqual([['likes']]);
    expect(calls('insert')).toEqual([[{ post_id: 'post-1' }]]);
  });

  it('treats liking an already-liked post as success', async () => {
    mockResult.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    await expect(likePost('post-1')).resolves.toBeUndefined();
  });

  it('surfaces other errors', async () => {
    mockResult.mockResolvedValue({ error: failed });
    await expect(likePost('post-1')).rejects.toBe(failed);
  });
});

describe('unlikePost', () => {
  it("deletes the member's like on that post", async () => {
    mockResult.mockResolvedValue({ error: null });
    await expect(unlikePost('post-1')).resolves.toBeUndefined();
    expect(calls('delete')).toEqual([[]]);
    expect(calls('eq')).toEqual([['post_id', 'post-1']]);
  });

  it('surfaces errors', async () => {
    mockResult.mockResolvedValue({ error: failed });
    await expect(unlikePost('post-1')).rejects.toBe(failed);
  });
});

describe('loadLikes', () => {
  it('returns nothing without querying when there are no posts', async () => {
    await expect(loadLikes([])).resolves.toEqual({});
    expect(calls('from')).toEqual([]);
  });

  it('counts likes per post and marks the ones the member liked', async () => {
    mockResult.mockResolvedValue({
      data: [
        { post_id: 'post-1', author_id: 'me' },
        { post_id: 'post-1', author_id: 'other' },
        { post_id: 'post-2', author_id: 'other' },
      ],
      error: null,
    });
    await expect(loadLikes(['post-1', 'post-2', 'post-3'])).resolves.toEqual({
      'post-1': { count: 2, likedByMe: true },
      'post-2': { count: 1, likedByMe: false },
      'post-3': { count: 0, likedByMe: false },
    });
    expect(calls('select')).toEqual([['post_id, author_id']]);
    expect(calls('in')).toEqual([['post_id', ['post-1', 'post-2', 'post-3']]]);
  });

  it('ignores likes for posts that were not requested', async () => {
    mockResult.mockResolvedValue({ data: [{ post_id: 'post-9', author_id: 'me' }], error: null });
    await expect(loadLikes(['post-1'])).resolves.toEqual({ 'post-1': { count: 0, likedByMe: false } });
  });

  it('marks nothing as liked when nobody is signed in', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockResult.mockResolvedValue({ data: [{ post_id: 'post-1', author_id: 'me' }], error: null });
    await expect(loadLikes(['post-1'])).resolves.toEqual({ 'post-1': { count: 1, likedByMe: false } });
  });

  it('surfaces session errors', async () => {
    const sessionError = new Error('session unavailable');
    mockGetSession.mockResolvedValue({ data: { session: null }, error: sessionError });
    await expect(loadLikes(['post-1'])).rejects.toBe(sessionError);
  });

  it('surfaces query errors', async () => {
    mockResult.mockResolvedValue({ data: null, error: failed });
    await expect(loadLikes(['post-1'])).rejects.toBe(failed);
  });
});
