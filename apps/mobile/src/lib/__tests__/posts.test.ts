import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { publishPost } from '../posts';

// Replace the Supabase client with a fake whose responses each test controls.
type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockMaybeSingle = jest.fn<AsyncCall>();
const mockInsert = jest.fn<AsyncCall>();
const mockUpload = jest.fn<AsyncCall>();
const mockRemove = jest.fn<AsyncCall>();
jest.mock('../supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }), insert: mockInsert }),
    storage: { from: () => ({ upload: mockUpload, remove: mockRemove }) },
  },
}));

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
