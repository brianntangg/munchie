import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { addComment, deleteComment, isValidComment, loadComments, MAX_COMMENT_LENGTH } from '../comments';

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
      for (const method of ['select', 'insert', 'delete', 'eq', 'order', 'range', 'single', 'maybeSingle']) {
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
const has = (query: Query, method: string) => callsOf(query, method).length > 0;

const failed = { code: '08006', message: 'connection failure' };
const row = (id: string, body = `Comment ${id}`, name: string | null = 'Casey') => ({
  id, post_id: 'post-1', author_id: `author-${id}`, body, created_at: '2026-11-08T12:00:00Z',
  profiles: name === null ? null : { display_name: name },
});
const rows = (count: number, start = 0) => Array.from({ length: count }, (_, index) => row(String(start + index)));

beforeEach(() => {
  jest.resetAllMocks();
  mockQueries.length = 0;
  mockRespond.mockResolvedValue({ data: [], error: null });
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'me' } } }, error: null });
});

describe('isValidComment', () => {
  it('allows up to 280 characters', () => {
    expect(MAX_COMMENT_LENGTH).toBe(280);
  });

  it.each(['a', 'Looks great', 'x'.repeat(280), `  ${'x'.repeat(280)}  `, '😀'.repeat(280)])('accepts %p', (body) => {
    expect(isValidComment(body)).toBe(true);
  });

  it.each(['', '   ', '\n\t', 'x'.repeat(281), '😀'.repeat(281)])('rejects %p', (body) => {
    expect(isValidComment(body)).toBe(false);
  });
});

describe('loadComments', () => {
  it("returns a post's comments oldest first with each author's name", async () => {
    mockRespond.mockResolvedValueOnce({ data: [row('1', 'First'), row('2', 'Second', 'Jordan')], error: null });
    await expect(loadComments('post-1')).resolves.toEqual([
      { id: '1', postId: 'post-1', authorId: 'author-1', authorName: 'Casey', body: 'First', createdAt: '2026-11-08T12:00:00Z' },
      { id: '2', postId: 'post-1', authorId: 'author-2', authorName: 'Jordan', body: 'Second', createdAt: '2026-11-08T12:00:00Z' },
    ]);
    expect(mockQueries).toHaveLength(1);
    expect(callsOf(mockQueries[0], 'eq')).toEqual([['post_id', 'post-1']]);
    expect(callsOf(mockQueries[0], 'order')).toEqual([['created_at', { ascending: true }], ['id', { ascending: true }]]);
    expect(callsOf(mockQueries[0], 'range')).toEqual([[0, 999]]);
  });

  it('keeps reading past the 1,000-row API limit', async () => {
    mockRespond.mockResolvedValueOnce({ data: rows(1000), error: null }).mockResolvedValueOnce({ data: rows(1, 1000), error: null });
    const comments = await loadComments('post-1');
    expect(comments).toHaveLength(1001);
    expect(comments.at(-1)?.id).toBe('1000');
    expect(mockQueries.map((query) => callsOf(query, 'range')[0])).toEqual([[0, 999], [1000, 1999]]);
  });

  it('stops after an empty page when the post has exactly 1,000 comments', async () => {
    mockRespond.mockResolvedValueOnce({ data: rows(1000), error: null }).mockResolvedValueOnce({ data: [], error: null });
    await expect(loadComments('post-1')).resolves.toHaveLength(1000);
    expect(mockQueries).toHaveLength(2);
  });

  it('falls back to a generic name when the author profile is missing', async () => {
    mockRespond.mockResolvedValueOnce({ data: [row('1', 'Hi', null)], error: null });
    const [comment] = await loadComments('post-1');
    expect(comment.authorName).toBe('Student');
  });

  it('surfaces errors, including on a later page', async () => {
    mockRespond.mockResolvedValueOnce({ data: rows(1000), error: null }).mockResolvedValueOnce({ data: null, error: failed });
    await expect(loadComments('post-1')).rejects.toBe(failed);
  });
});

describe('addComment', () => {
  it('rejects an invalid comment without contacting the database', async () => {
    await expect(addComment({ postId: 'post-1', body: '   ' })).rejects.toThrow('Comments must be 1 to 280 characters.');
    expect(mockQueries).toEqual([]);
  });

  it('inserts the trimmed text with only the post id and returns the saved comment', async () => {
    mockRespond.mockResolvedValue({ data: row('1', 'Looks great'), error: null });
    await expect(addComment({ postId: 'post-1', body: '  Looks great \n' })).resolves.toMatchObject({ id: '1', body: 'Looks great', authorName: 'Casey' });
    expect(callsOf(mockQueries[0], 'insert')).toEqual([[{ post_id: 'post-1', body: 'Looks great' }]]);
    expect(has(mockQueries[0], 'single')).toBe(true);
  });

  it('surfaces errors', async () => {
    mockRespond.mockResolvedValue({ data: null, error: failed });
    await expect(addComment({ postId: 'post-1', body: 'Hi' })).rejects.toBe(failed);
  });
});

describe('deleteComment', () => {
  const answer = (deleted: { id: string }[] | null, remaining: { id: string } | null, errors: { delete?: unknown; lookup?: unknown } = {}) =>
    mockRespond.mockImplementation(async (query) => (has(query, 'delete')
      ? { data: deleted, error: errors.delete ?? null }
      : { data: remaining, error: errors.lookup ?? null }));

  it("deletes the comment, naming the member's own row", async () => {
    answer([{ id: 'c-1' }], null);
    await expect(deleteComment('c-1')).resolves.toBeUndefined();
    expect(callsOf(mockQueries[0], 'eq')).toEqual([['id', 'c-1'], ['author_id', 'me']]);
    expect(mockQueries).toHaveLength(1);
  });

  it('treats a comment that is already gone as deleted', async () => {
    answer([], null);
    await expect(deleteComment('c-1')).resolves.toBeUndefined();
    expect(callsOf(mockQueries[1], 'eq')).toEqual([['id', 'c-1']]);
  });

  it("reports when the comment still exists because it is someone else's", async () => {
    answer([], { id: 'c-1' });
    await expect(deleteComment('c-1')).rejects.toThrow('You can only delete your own comments.');
  });

  it('asks the member to sign in, without deleting anything, when nobody is signed in', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(deleteComment('c-1')).rejects.toThrow('Sign in to delete comments.');
    expect(mockQueries).toEqual([]);
  });

  it('surfaces session errors', async () => {
    const sessionError = new Error('session unavailable');
    mockGetSession.mockResolvedValue({ data: { session: null }, error: sessionError });
    await expect(deleteComment('c-1')).rejects.toBe(sessionError);
  });

  it('surfaces delete errors', async () => {
    answer(null, null, { delete: failed });
    await expect(deleteComment('c-1')).rejects.toBe(failed);
  });

  it('surfaces errors from checking whether the comment still exists', async () => {
    answer([], null, { lookup: failed });
    await expect(deleteComment('c-1')).rejects.toBe(failed);
  });
});
