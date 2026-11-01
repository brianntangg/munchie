import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { loadProfile, postCountLabel } from '../profiles';

// Each table gets a chainable fake query. The profile lookup ends in maybeSingle();
// the post count query is awaited directly.
type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockCalls = jest.fn<(table: string, method: string, ...args: unknown[]) => void>();
const mockProfile = jest.fn<AsyncCall>();
const mockCount = jest.fn<AsyncCall>();
jest.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const query: Record<string, unknown> = {
        maybeSingle: () => mockProfile(),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockCount().then(resolve, reject),
      };
      for (const method of ['select', 'eq']) {
        query[method] = (...args: unknown[]) => {
          mockCalls(table, method, ...args);
          return query;
        };
      }
      return query;
    },
  },
}));

beforeEach(() => {
  jest.resetAllMocks();
  mockProfile.mockResolvedValue({ data: { id: 'user-2', display_name: 'Casey' }, error: null });
  mockCount.mockResolvedValue({ count: 3, error: null });
});

describe('loadProfile', () => {
  it("returns the student's name and post count", async () => {
    await expect(loadProfile('user-2')).resolves.toEqual({ id: 'user-2', displayName: 'Casey', postCount: 3 });
    expect(mockCalls).toHaveBeenCalledWith('profiles', 'eq', 'id', 'user-2');
    expect(mockCalls).toHaveBeenCalledWith('posts', 'select', 'id', { count: 'exact', head: true });
    expect(mockCalls).toHaveBeenCalledWith('posts', 'eq', 'author_id', 'user-2');
  });

  it('counts zero posts when the count is missing', async () => {
    mockCount.mockResolvedValue({ count: null, error: null });
    await expect(loadProfile('user-2')).resolves.toMatchObject({ postCount: 0 });
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

  it('throws when the post count query fails', async () => {
    const error = new Error('count failed');
    mockCount.mockResolvedValue({ count: null, error });
    await expect(loadProfile('user-2')).rejects.toBe(error);
  });
});

describe('postCountLabel', () => {
  it.each([[0, '0 posts'], [1, '1 post'], [2, '2 posts']])('labels %i as %s', (count, label) => {
    expect(postCountLabel(count)).toBe(label);
  });
});
