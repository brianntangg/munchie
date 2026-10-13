import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { loadPost, loadPosts, PAGE_SIZE, publishPost } from '../posts';

// Replace the Supabase client with a fake whose responses each test controls.
// Query methods record their arguments in mockQueryCall and return the same chainable query;
// awaiting a list query resolves to mockListResult().
type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockQueryCall = jest.fn<(method: string, ...args: unknown[]) => void>();
const mockListResult = jest.fn<AsyncCall>();
const mockMaybeSingle = jest.fn<AsyncCall>();
const mockInsert = jest.fn<AsyncCall>();
const mockUpload = jest.fn<AsyncCall>();
const mockRemove = jest.fn<AsyncCall>();
const mockCreateSignedUrls = jest.fn<AsyncCall>();
const mockCreateSignedUrl = jest.fn<AsyncCall>();
jest.mock('../supabase', () => {
  const query: Record<string, unknown> = {
    maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockListResult().then(resolve, reject),
  };
  for (const method of ['select', 'order', 'limit', 'eq', 'or']) {
    query[method] = (...args: unknown[]) => {
      mockQueryCall(method, ...args);
      return query;
    };
  }
  return {
    supabase: {
      from: () => query,
      storage: {
        from: () => ({
          upload: (...args: unknown[]) => mockUpload(...args),
          remove: (...args: unknown[]) => mockRemove(...args),
          createSignedUrls: (...args: unknown[]) => mockCreateSignedUrls(...args),
          createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
        }),
      },
    },
  };
});
const queryCalls = (method: string) => mockQueryCall.mock.calls.filter(([name]) => name === method).map(([, ...args]) => args);

const MAX_BYTES = 5 * 1024 * 1024;
const photo = (bytes: number) => btoa('\0'.repeat(bytes));
const post = { id: 'post-1', userId: 'user-1', hallId: 'hall-1', caption: '  Great pasta  ', base64: photo(10) };
const path = 'user-1/post-1.jpg';

beforeEach(() => {
  jest.resetAllMocks();
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockUpload.mockResolvedValue({ error: null });
  mockInsert.mockResolvedValue({ error: null });
  mockRemove.mockResolvedValue({ error: null });
  mockListResult.mockResolvedValue({ data: [], error: null });
  mockCreateSignedUrls.mockResolvedValue({ data: [], error: null });
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://photos/one' }, error: null });
});

describe('publishPost photo size', () => {
  it('accepts a photo of exactly 5 MB', async () => {
    await expect(publishPost({ ...post, base64: photo(MAX_BYTES) })).resolves.toBeUndefined();
    expect((mockUpload.mock.calls[0][1] as ArrayBuffer).byteLength).toBe(MAX_BYTES);
  });

  it('rejects a photo one byte over 5 MB without uploading', async () => {
    await expect(publishPost({ ...post, base64: photo(MAX_BYTES + 1) })).rejects.toThrow('maximum 5 MB');
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe('publishPost success', () => {
  it('uploads to the owner folder and inserts the post with a trimmed caption', async () => {
    await publishPost(post);
    expect(mockUpload).toHaveBeenCalledWith(path, expect.any(ArrayBuffer), { contentType: 'image/jpeg', upsert: false });
    expect(mockInsert).toHaveBeenCalledWith({ id: 'post-1', author_id: 'user-1', dining_hall_id: 'hall-1', caption: 'Great pasta', photo_path: path });
  });
});

describe('publishPost retries', () => {
  it('does nothing when the post already exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'post-1' }, error: null });
    await publishPost(post);
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('still creates the post when the photo was already uploaded (409)', async () => {
    mockUpload.mockResolvedValue({ error: { statusCode: '409', message: 'The resource already exists' } });
    await publishPost(post);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});

describe('publishPost failures', () => {
  it('throws when the existing-post check fails', async () => {
    const checkError = new Error('network down');
    mockMaybeSingle.mockResolvedValue({ data: null, error: checkError });
    await expect(publishPost(post)).rejects.toBe(checkError);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('throws other upload errors without inserting', async () => {
    const uploadError = { statusCode: '500', message: 'Storage unavailable' };
    mockUpload.mockResolvedValue({ error: uploadError });
    await expect(publishPost(post)).rejects.toBe(uploadError);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('removes the uploaded photo when the insert fails and no post was saved', async () => {
    const insertError = { code: '23514', message: 'check violation' };
    mockInsert.mockResolvedValue({ error: insertError });
    await expect(publishPost(post)).rejects.toBe(insertError);
    expect(mockRemove).toHaveBeenCalledWith([path]);
  });

  it('succeeds without cleanup when the insert errored but the post was saved', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'connection reset' } });
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'post-1' }, error: null });
    await expect(publishPost(post)).resolves.toBeUndefined();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('keeps the photo when it cannot confirm whether the post was saved', async () => {
    const insertError = { message: 'connection reset' };
    mockInsert.mockResolvedValue({ error: insertError });
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'still offline' } });
    await expect(publishPost(post)).rejects.toBe(insertError);
    expect(mockRemove).not.toHaveBeenCalled();
  });
});

const row = (id: string) => ({ id, photo_path: `user-1/${id}.jpg`, caption: '', profiles: { display_name: 'Alice' }, dining_halls: { name: 'Rand' } });

describe('loadPosts filters', () => {
  it('loads the newest page with no filters', async () => {
    await loadPosts();
    expect(queryCalls('order')).toEqual([['created_at', { ascending: false }], ['id', { ascending: false }]]);
    expect(queryCalls('limit')).toEqual([[PAGE_SIZE]]);
    expect(queryCalls('eq')).toEqual([]);
    expect(queryCalls('or')).toEqual([]);
  });

  it('filters by dining hall', async () => {
    await loadPosts(undefined, { hallId: 'hall-1' });
    expect(queryCalls('eq')).toEqual([['dining_hall_id', 'hall-1']]);
  });

  it('filters by author', async () => {
    await loadPosts(undefined, { authorId: 'user-1' });
    expect(queryCalls('eq')).toEqual([['author_id', 'user-1']]);
  });

  it('continues after the cursor, breaking timestamp ties by id', async () => {
    await loadPosts({ created_at: '2026-10-01T12:00:00Z', id: 'post-9' });
    expect(queryCalls('or')).toEqual([['created_at.lt.2026-10-01T12:00:00Z,and(created_at.eq.2026-10-01T12:00:00Z,id.lt.post-9)']]);
  });
});

describe('loadPosts results', () => {
  it('returns an empty page without requesting photo links', async () => {
    await expect(loadPosts()).resolves.toEqual([]);
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });

  it('attaches a one-hour photo link to each post, or null when none is returned', async () => {
    mockListResult.mockResolvedValue({ data: [row('a'), row('b'), row('c')], error: null });
    mockCreateSignedUrls.mockResolvedValue({ data: [{ signedUrl: 'https://photos/a' }, { signedUrl: null }], error: null });
    const posts = await loadPosts();
    expect(mockCreateSignedUrls).toHaveBeenCalledWith(['user-1/a.jpg', 'user-1/b.jpg', 'user-1/c.jpg'], 3600);
    expect(posts.map((p) => p.imageUrl)).toEqual(['https://photos/a', null, null]);
  });

  it('throws when the query fails', async () => {
    const queryError = { message: 'permission denied' };
    mockListResult.mockResolvedValue({ data: null, error: queryError });
    await expect(loadPosts()).rejects.toBe(queryError);
  });

  it('throws when photo links cannot be created', async () => {
    const urlError = { message: 'storage unavailable' };
    mockListResult.mockResolvedValue({ data: [row('a')], error: null });
    mockCreateSignedUrls.mockResolvedValue({ data: null, error: urlError });
    await expect(loadPosts()).rejects.toBe(urlError);
  });
});

describe('loadPost', () => {
  it('returns null for a missing post without requesting a photo link', async () => {
    await expect(loadPost('missing')).resolves.toBeNull();
    expect(queryCalls('eq')).toEqual([['id', 'missing']]);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it('returns the post with a one-hour photo link', async () => {
    mockMaybeSingle.mockResolvedValue({ data: row('one'), error: null });
    await expect(loadPost('one')).resolves.toEqual({ ...row('one'), imageUrl: 'https://photos/one' });
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('user-1/one.jpg', 3600);
  });

  it('throws when the query fails', async () => {
    const queryError = { message: 'permission denied' };
    mockMaybeSingle.mockResolvedValue({ data: null, error: queryError });
    await expect(loadPost('one')).rejects.toBe(queryError);
  });

  it('throws when the photo link cannot be created', async () => {
    const photoError = { message: 'storage unavailable' };
    mockMaybeSingle.mockResolvedValue({ data: row('one'), error: null });
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: photoError });
    await expect(loadPost('one')).rejects.toBe(photoError);
  });
});
