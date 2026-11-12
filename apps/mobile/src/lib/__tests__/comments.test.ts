import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { addComment, deleteComment, isValidComment, loadComments, MAX_COMMENT_LENGTH } from '../comments';

// Replace the Supabase client with a chainable fake. Every query method records its arguments in mockCall;
// awaiting a query resolves to mockResult(kind), where kind is 'insert', 'delete', or 'select'.
const mockCall = jest.fn<(method: string, ...args: unknown[]) => void>();
const mockResult = jest.fn<(kind: string) => Promise<unknown>>();
jest.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      mockCall('from', table);
      let kind = 'select';
      const query: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockResult(kind).then(resolve, reject),
      };
      for (const method of ['select', 'insert', 'delete', 'eq', 'order', 'single']) {
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
const row = (id: string, body: string, name: string | null = 'Casey') => ({
  id, post_id: 'post-1', author_id: `author-${id}`, body, created_at: `2026-11-08T12:00:0${id}Z`,
  profiles: name === null ? null : { display_name: name },
});

beforeEach(() => {
  jest.resetAllMocks();
  mockResult.mockResolvedValue({ data: [], error: null });
});

describe('isValidComment', () => {
  it('allows up to 280 characters', () => {
    expect(MAX_COMMENT_LENGTH).toBe(280);
  });

  it.each(['a', 'Looks great', 'x'.repeat(280), `  ${'x'.repeat(280)}  `])('accepts %p', (body) => {
    expect(isValidComment(body)).toBe(true);
  });

  it.each(['', '   ', '\n\t', 'x'.repeat(281)])('rejects %p', (body) => {
    expect(isValidComment(body)).toBe(false);
  });
});

describe('loadComments', () => {
  it("returns a post's comments oldest first with each author's name", async () => {
    mockResult.mockResolvedValue({ data: [row('1', 'First'), row('2', 'Second', 'Jordan')], error: null });
    await expect(loadComments('post-1')).resolves.toEqual([
      { id: '1', postId: 'post-1', authorId: 'author-1', authorName: 'Casey', body: 'First', createdAt: '2026-11-08T12:00:01Z' },
      { id: '2', postId: 'post-1', authorId: 'author-2', authorName: 'Jordan', body: 'Second', createdAt: '2026-11-08T12:00:02Z' },
    ]);
    expect(calls('from')).toEqual([['comments']]);
    expect(calls('eq')).toEqual([['post_id', 'post-1']]);
    expect(calls('order')).toEqual([['created_at', { ascending: true }], ['id', { ascending: true }]]);
  });

  it('falls back to a generic name when the author profile is missing', async () => {
    mockResult.mockResolvedValue({ data: [row('1', 'Hi', null)], error: null });
    const [comment] = await loadComments('post-1');
    expect(comment.authorName).toBe('Student');
  });

  it('surfaces errors', async () => {
    mockResult.mockResolvedValue({ data: null, error: failed });
    await expect(loadComments('post-1')).rejects.toBe(failed);
  });
});

describe('addComment', () => {
  it('rejects an invalid comment without contacting the database', async () => {
    await expect(addComment({ postId: 'post-1', body: '   ' })).rejects.toThrow('Comments must be 1 to 280 characters.');
    expect(calls('from')).toEqual([]);
  });

  it('inserts the trimmed text with only the post id and returns the saved comment', async () => {
    mockResult.mockResolvedValue({ data: row('1', 'Looks great'), error: null });
    await expect(addComment({ postId: 'post-1', body: '  Looks great \n' })).resolves.toMatchObject({ id: '1', body: 'Looks great', authorName: 'Casey' });
    expect(calls('insert')).toEqual([[{ post_id: 'post-1', body: 'Looks great' }]]);
    expect(calls('single')).toEqual([[]]);
  });

  it('surfaces errors', async () => {
    mockResult.mockResolvedValue({ data: null, error: failed });
    await expect(addComment({ postId: 'post-1', body: 'Hi' })).rejects.toBe(failed);
  });
});

describe('deleteComment', () => {
  it('deletes the comment by id', async () => {
    mockResult.mockResolvedValue({ data: [{ id: 'c-1' }], error: null });
    await expect(deleteComment('c-1')).resolves.toBeUndefined();
    expect(calls('delete')).toEqual([[]]);
    expect(calls('eq')).toEqual([['id', 'c-1']]);
  });

  it("reports when nothing was deleted because the comment is someone else's", async () => {
    await expect(deleteComment('c-1')).rejects.toThrow('You can only delete your own comments.');
  });

  it('surfaces errors', async () => {
    mockResult.mockResolvedValue({ data: null, error: failed });
    await expect(deleteComment('c-1')).rejects.toBe(failed);
  });
});
