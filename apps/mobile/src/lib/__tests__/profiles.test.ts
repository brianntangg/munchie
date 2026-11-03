import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { countLabel, loadProfile } from '../profiles';

// Each table gets a chainable fake query. The profile lookup ends in maybeSingle();
// count queries are awaited directly and resolve to mockCount(table, column).
type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockCalls = jest.fn<(table: string, method: string, ...args: unknown[]) => void>();
const mockProfile = jest.fn<AsyncCall>();
const mockCount = jest.fn<(table: string, column: string) => Promise<unknown>>();
jest.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      let column = '';
      const query: Record<string, unknown> = {
        maybeSingle: () => mockProfile(),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockCount(table, column).then(resolve, reject),
      };
      for (const method of ['select', 'eq']) {
        query[method] = (...args: unknown[]) => {
          mockCalls(table, method, ...args);
          if (method === 'eq') column = args[0] as string;
          return query;
        };
      }
      return query;
    },
  },
}));

const counts: Record<string, number | null> = { 'posts.author_id': 3, 'follows.followee_id': 5, 'follows.follower_id': 1 };
const countResult = (table: string, column: string) => Promise.resolve({ count: counts[`${table}.${column}`], error: null });

beforeEach(() => {
  jest.resetAllMocks();
  mockProfile.mockResolvedValue({ data: { id: 'user-2', display_name: 'Casey' }, error: null });
  mockCount.mockImplementation(countResult);
});

describe('loadProfile', () => {
  it("returns the student's name, post count, and follow counts", async () => {
    await expect(loadProfile('user-2')).resolves.toEqual({ id: 'user-2', displayName: 'Casey', postCount: 3, followerCount: 5, followingCount: 1 });
    expect(mockCalls).toHaveBeenCalledWith('profiles', 'eq', 'id', 'user-2');
    expect(mockCalls).toHaveBeenCalledWith('posts', 'eq', 'author_id', 'user-2');
    expect(mockCalls).toHaveBeenCalledWith('follows', 'eq', 'followee_id', 'user-2');
    expect(mockCalls).toHaveBeenCalledWith('follows', 'eq', 'follower_id', 'user-2');
  });

  it('downloads no rows for the counts', async () => {
    await loadProfile('user-2');
    const countSelects = mockCalls.mock.calls.filter(([table, method]) => table !== 'profiles' && method === 'select');
    expect(countSelects).toHaveLength(3);
    for (const [, , , options] of countSelects) expect(options).toEqual({ count: 'exact', head: true });
  });

  it('counts zero when a count is missing', async () => {
    mockCount.mockResolvedValue({ count: null, error: null });
    await expect(loadProfile('user-2')).resolves.toMatchObject({ postCount: 0, followerCount: 0, followingCount: 0 });
  });

  it('returns null when no member has the id', async () => {
    mockProfile.mockResolvedValue({ data: null, error: null });
    await expect(loadProfile('missing')).resolves.toBeNull();
  });

  it('throws when the profile query fails', async () => {
    const error = new Error('profile failed');
    mockProfile.mockResolvedValue({ data: null, error });
    await expect(loadProfile('user-2')).rejects.toBe(error);
  });

  it.each([['posts', 'author_id'], ['follows', 'followee_id'], ['follows', 'follower_id']])('throws when the %s.%s count fails', async (table, column) => {
    const error = new Error('count failed');
    mockCount.mockImplementation((t, c) => (t === table && c === column ? Promise.resolve({ count: null, error }) : countResult(t, c)));
    await expect(loadProfile('user-2')).rejects.toBe(error);
  });
});

describe('countLabel', () => {
  it.each([[0, 'post', '0 posts'], [1, 'post', '1 post'], [2, 'post', '2 posts'], [1, 'follower', '1 follower'], [7, 'follower', '7 followers']])('labels %i %s as %s', (count, noun, label) => {
    expect(countLabel(count, noun)).toBe(label);
  });
});
