import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { followUser, isFollowing, loadConnections, loadFollowingIds, unfollowUser } from '../follows';

const mockCalls = jest.fn<(method: string, ...args: unknown[]) => void>();
const mockResult = jest.fn<() => Promise<unknown>>();

jest.mock('../supabase', () => ({
  supabase: {
    from: () => {
      const query: Record<string, unknown> = {
        maybeSingle: () => mockResult(),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockResult().then(resolve, reject),
      };
      for (const method of ['select', 'eq', 'in', 'insert', 'delete']) {
        query[method] = (...args: unknown[]) => {
          mockCalls(method, ...args);
          return query;
        };
      }
      return query;
    },
  },
}));

beforeEach(() => {
  jest.resetAllMocks();
  mockResult.mockResolvedValue({ data: null, error: null });
});

describe('follow operations', () => {
  it('detects an existing follow', async () => {
    mockResult.mockResolvedValue({ data: { follower_id: 'a' }, error: null });
    await expect(isFollowing('a', 'b')).resolves.toBe(true);
    expect(mockCalls).toHaveBeenCalledWith('eq', 'follower_id', 'a');
    expect(mockCalls).toHaveBeenCalledWith('eq', 'followee_id', 'b');
  });

  it('returns false when no follow exists', async () => {
    await expect(isFollowing('a', 'b')).resolves.toBe(false);
  });

  it('inserts only the followee', async () => {
    await expect(followUser('b')).resolves.toBeUndefined();
    expect(mockCalls).toHaveBeenCalledWith('insert', { followee_id: 'b' });
  });

  it('deletes the current user follow', async () => {
    await expect(unfollowUser('b')).resolves.toBeUndefined();
    expect(mockCalls).toHaveBeenCalledWith('delete');
    expect(mockCalls).toHaveBeenCalledWith('eq', 'followee_id', 'b');
  });

  it('throws Supabase errors', async () => {
    const error = new Error('request failed');
    mockResult.mockResolvedValue({ data: null, error });
    await expect(followUser('b')).rejects.toBe(error);
  });
});

describe('connection queries', () => {
  it('loads the accounts the user follows', async () => {
    mockResult.mockResolvedValue({ data: [{ followee_id: 'b' }, { followee_id: 'c' }], error: null });
    await expect(loadFollowingIds('a')).resolves.toEqual(['b', 'c']);
    expect(mockCalls).toHaveBeenCalledWith('eq', 'follower_id', 'a');
  });

  it('loads followers with profile names', async () => {
    mockResult
      .mockResolvedValueOnce({ data: [{ follower_id: 'b', followee_id: 'a' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'b', display_name: 'Taylor' }], error: null });
    await expect(loadConnections('a', 'followers')).resolves.toEqual([{ id: 'b', displayName: 'Taylor' }]);
    expect(mockCalls).toHaveBeenCalledWith('eq', 'followee_id', 'a');
    expect(mockCalls).toHaveBeenCalledWith('in', 'id', ['b']);
  });

  it('does not load profiles when there are no connections', async () => {
    mockResult.mockResolvedValue({ data: [], error: null });
    await expect(loadConnections('a', 'following')).resolves.toEqual([]);
    expect(mockCalls).not.toHaveBeenCalledWith('in', 'id', expect.anything());
  });
});
