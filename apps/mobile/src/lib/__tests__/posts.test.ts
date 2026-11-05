import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { loadPost, loadPosts, MAX_DISH_TEXT, MAX_PHOTOS, PAGE_SIZE, publishPost } from '../posts';

// Replace the Supabase client with a fake whose responses each test controls.
// Query methods record their arguments in mockQueryCall and return the same chainable query;
// awaiting a list query resolves to mockListResult().
type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockQueryCall = jest.fn<(method: string, ...args: unknown[]) => void>();
const mockListResult = jest.fn<AsyncCall>();
const mockMaybeSingle = jest.fn<AsyncCall>();
const mockInsert = jest.fn<AsyncCall>();
const mockUpsert = jest.fn<AsyncCall>();
const mockUpload = jest.fn<AsyncCall>();
const mockRemove = jest.fn<AsyncCall>();
const mockCreateSignedUrls = jest.fn<AsyncCall>();
jest.mock('../supabase', () => {
  const query: Record<string, unknown> = {
    maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    upsert: (...args: unknown[]) => mockUpsert(...args),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockListResult().then(resolve, reject),
  };
  for (const method of ['select', 'order', 'limit', 'eq', 'or', 'in']) {
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
        }),
      },
    },
  };
});
const queryCalls = (method: string) => mockQueryCall.mock.calls.filter(([name]) => name === method).map(([, ...args]) => args);

const MAX_BYTES = 5 * 1024 * 1024;
const photo = (bytes: number) => btoa('\0'.repeat(bytes));
// The first photo is the cover (stored under the post's id); later ones are stored under their own ids.
const cover = { id: 'photo-0', base64: photo(10) };
const extra = (n: number, menuItemId?: string) => ({ id: `photo-${n}`, base64: photo(10), ...(menuItemId ? { menuItemId } : {}) });
const post = { id: 'post-1', userId: 'user-1', hallId: 'hall-1', caption: '  Great pasta  ', photos: [cover] };
const path = 'user-1/post-1.jpg';
const saved = { data: { id: 'post-1', author_id: 'user-1' }, error: null };

beforeEach(() => {
  jest.resetAllMocks();
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockUpload.mockResolvedValue({ error: null });
  mockInsert.mockResolvedValue({ error: null });
  mockUpsert.mockResolvedValue({ error: null });
  mockRemove.mockResolvedValue({ error: null });
  mockListResult.mockResolvedValue({ data: [], error: null });
  mockCreateSignedUrls.mockResolvedValue({ data: [], error: null });
});

describe('publishPost photo size', () => {
  it('accepts a photo of exactly 5 MB', async () => {
    await expect(publishPost({ ...post, photos: [{ ...cover, base64: photo(MAX_BYTES) }] })).resolves.toBeUndefined();
    expect((mockUpload.mock.calls[0][1] as ArrayBuffer).byteLength).toBe(MAX_BYTES);
  });

  it('rejects a photo one byte over 5 MB without uploading', async () => {
    await expect(publishPost({ ...post, photos: [{ ...cover, base64: photo(MAX_BYTES + 1) }] })).rejects.toThrow('maximum 5 MB');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects an oversized extra photo before uploading any photo', async () => {
    await expect(publishPost({ ...post, photos: [cover, { ...extra(1), base64: photo(MAX_BYTES + 1) }] })).rejects.toThrow('maximum 5 MB');
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe('publishPost validation', () => {
  it('needs at least one photo', async () => {
    await expect(publishPost({ ...post, photos: [] })).rejects.toThrow('Add a photo');
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('accepts the maximum number of photos and rejects one more', async () => {
    const photos = (count: number) => [cover, ...Array.from({ length: count - 1 }, (_, i) => extra(i + 1))];
    await expect(publishPost({ ...post, photos: photos(MAX_PHOTOS) })).resolves.toBeUndefined();
    jest.clearAllMocks();
    await expect(publishPost({ ...post, photos: photos(MAX_PHOTOS + 1) })).rejects.toThrow(`up to ${MAX_PHOTOS} photos`);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects a photo that names both a menu dish and free text', async () => {
    await expect(publishPost({ ...post, photos: [{ ...cover, menuItemId: 'dish-1', dishText: 'Soup' }] })).rejects.toThrow('not both');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it.each([['blank', '   '], ['empty', ''], ['too long', 'x'.repeat(MAX_DISH_TEXT + 1)]])('rejects %s free text before doing anything', async (_name, dishText) => {
    await expect(publishPost({ ...post, photos: [cover, { ...extra(1), dishText }] })).rejects.toThrow(`1 to ${MAX_DISH_TEXT} characters`);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('accepts free text of exactly the maximum length', async () => {
    await expect(publishPost({ ...post, photos: [{ ...cover, dishText: 'x'.repeat(MAX_DISH_TEXT) }] })).resolves.toBeUndefined();
  });

  it('rejects the same dish on two photos before doing anything', async () => {
    await expect(publishPost({ ...post, photos: [{ ...cover, menuItemId: 'dish-1' }, extra(1, 'dish-1')] })).rejects.toThrow('only one photo');
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe('publishPost success', () => {
  it('uploads to the owner folder and inserts the post with a trimmed caption', async () => {
    await publishPost(post);
    expect(mockUpload).toHaveBeenCalledWith(path, expect.any(ArrayBuffer), { contentType: 'image/jpeg', upsert: false });
    expect(mockInsert).toHaveBeenCalledWith({ id: 'post-1', author_id: 'user-1', dining_hall_id: 'hall-1', caption: 'Great pasta', photo_path: path });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("records the cover photo's dish on the post", async () => {
    await publishPost({ ...post, photos: [{ ...cover, menuItemId: 'dish-1' }] });
    expect(mockInsert).toHaveBeenCalledWith({ id: 'post-1', author_id: 'user-1', dining_hall_id: 'hall-1', menu_item_id: 'dish-1', caption: 'Great pasta', photo_path: path });
  });

  it('records free text for the cover and for extra photos, trimmed, instead of a menu dish', async () => {
    await publishPost({ ...post, photos: [{ ...cover, dishText: '  Grandma’s soup ' }, { ...extra(1), dishText: 'Mystery taco' }] });
    expect(mockInsert).toHaveBeenCalledWith({ id: 'post-1', author_id: 'user-1', dining_hall_id: 'hall-1', dish_text: 'Grandma’s soup', caption: 'Great pasta', photo_path: path });
    expect(mockUpsert).toHaveBeenCalledWith([{ id: 'photo-1', post_id: 'post-1', dining_hall_id: 'hall-1', slot: 1, photo_path: 'user-1/photo-1.jpg', dish_text: 'Mystery taco' }], { onConflict: 'id', ignoreDuplicates: true });
  });

  it('stores the cover under the post id and extra photos under their own ids, then attaches them in one request', async () => {
    await publishPost({ ...post, photos: [{ ...cover, menuItemId: 'dish-1' }, extra(1, 'dish-2'), extra(2)] });
    expect(mockUpload.mock.calls.map(([photoPath]) => photoPath)).toEqual([path, 'user-1/photo-1.jpg', 'user-1/photo-2.jpg']);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith([
      { id: 'photo-1', post_id: 'post-1', dining_hall_id: 'hall-1', slot: 1, photo_path: 'user-1/photo-1.jpg', menu_item_id: 'dish-2' },
      { id: 'photo-2', post_id: 'post-1', dining_hall_id: 'hall-1', slot: 2, photo_path: 'user-1/photo-2.jpg' },
    ], { onConflict: 'id', ignoreDuplicates: true });
    expect(mockInsert.mock.invocationCallOrder[0]).toBeLessThan(mockUpsert.mock.invocationCallOrder[0]);
  });
});

describe('publishPost retries', () => {
  it('does nothing when a one-photo post already exists', async () => {
    mockMaybeSingle.mockResolvedValue(saved);
    await publishPost(post);
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('only finishes attaching the extra photos when the post already exists', async () => {
    mockMaybeSingle.mockResolvedValue(saved);
    await publishPost({ ...post, photos: [cover, extra(1)] });
    expect(mockUpload.mock.calls.map(([photoPath]) => photoPath)).toEqual(['user-1/photo-1.jpg']);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('refuses to add photos to a post written by someone else', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'post-1', author_id: 'user-2' }, error: null });
    await expect(publishPost({ ...post, photos: [cover, extra(1)] })).rejects.toThrow('another member');
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
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

  it('removes every uploaded photo when the insert fails and no post was saved', async () => {
    const insertError = { code: '23514', message: 'check violation' };
    mockInsert.mockResolvedValue({ error: insertError });
    await expect(publishPost({ ...post, photos: [cover, extra(1)] })).rejects.toBe(insertError);
    expect(mockRemove).toHaveBeenCalledWith([path, 'user-1/photo-1.jpg']);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('succeeds without cleanup when the insert errored but the post was saved', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'connection reset' } });
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'post-1' }, error: null });
    await expect(publishPost(post)).resolves.toBeUndefined();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('still attaches the extra photos when the insert errored but the post was saved', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'connection reset' } });
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'post-1' }, error: null });
    await publishPost({ ...post, photos: [cover, extra(1)] });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('keeps the photos when it cannot confirm whether the post was saved', async () => {
    const insertError = { message: 'connection reset' };
    mockInsert.mockResolvedValue({ error: insertError });
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'still offline' } });
    await expect(publishPost(post)).rejects.toBe(insertError);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('throws when the extra photos cannot be attached, keeping the post and its photos so a retry can finish', async () => {
    const attachError = { code: '42501', message: 'permission denied' };
    mockUpsert.mockResolvedValue({ error: attachError });
    await expect(publishPost({ ...post, photos: [cover, extra(1)] })).rejects.toBe(attachError);
    expect(mockRemove).not.toHaveBeenCalled();
  });
});

// A photo of a post as returned by the feed query: slot 0 is the cover, stored under the post id.
const photoRow = (postId: string, slot: number, fields: object = {}) => {
  const id = slot === 0 ? postId : `${postId}-${slot}`;
  return { id, slot, photo_path: `user-1/${id}.jpg`, menu_item_id: null, dish_text: null, menu_items: null, ...fields };
};
const row = (id: string, photos = [photoRow(id, 0)]) => ({ id, author_id: 'user-1', photo_path: `user-1/${id}.jpg`, caption: '', profiles: { display_name: 'Alice' }, dining_halls: { name: 'Rand' }, post_photos: photos });
const { post_photos: _unused, ...withoutPhotos } = row('x');

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

  it('attaches a one-hour photo link to each photo, or null when none is returned', async () => {
    mockListResult.mockResolvedValue({ data: [row('a'), row('b'), row('c')], error: null });
    mockCreateSignedUrls.mockResolvedValue({ data: [{ signedUrl: 'https://photos/a' }, { signedUrl: null }], error: null });
    const posts = await loadPosts();
    expect(mockCreateSignedUrls).toHaveBeenCalledWith(['user-1/a.jpg', 'user-1/b.jpg', 'user-1/c.jpg'], 3600);
    expect(posts.map((p) => p.photos.map((photo) => photo.imageUrl))).toEqual([['https://photos/a'], [null], [null]]);
  });

  it('puts a post\'s photos in slot order, cover first, and links each to its own file', async () => {
    mockListResult.mockResolvedValue({ data: [row('a', [photoRow('a', 2), photoRow('a', 0), photoRow('a', 1)]), row('b')], error: null });
    mockCreateSignedUrls.mockResolvedValue({ data: ['a', 'a-1', 'a-2', 'b'].map((name) => ({ signedUrl: `https://photos/${name}` })), error: null });
    const [first, second] = await loadPosts();
    expect(mockCreateSignedUrls).toHaveBeenCalledWith(['user-1/a.jpg', 'user-1/a-1.jpg', 'user-1/a-2.jpg', 'user-1/b.jpg'], 3600);
    expect(first.photos.map((photo) => [photo.id, photo.imageUrl])).toEqual([['a', 'https://photos/a'], ['a-1', 'https://photos/a-1'], ['a-2', 'https://photos/a-2']]);
    expect(second.photos.map((photo) => photo.imageUrl)).toEqual(['https://photos/b']);
  });

  it('does not expose the raw photo rows on the post', async () => {
    mockListResult.mockResolvedValue({ data: [row('a')], error: null });
    const [first] = await loadPosts();
    expect(first).not.toHaveProperty('post_photos');
    expect(first).toMatchObject({ id: 'a', profiles: { display_name: 'Alice' }, dining_halls: { name: 'Rand' } });
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

// A photo tagged with a dish, as returned with the dish name joined in.
const dishPhoto = (postId: string, slot: number, itemId: string, dishName: string) => photoRow(postId, slot, { menu_item_id: itemId, menu_items: { name: dishName } });
const dishPost = (id: string, authorId: string, photos: ReturnType<typeof photoRow>[]) => ({ ...row(id, photos), author_id: authorId });

describe('loadPosts dishes', () => {
  it("shows each photo's dish with its author's own score for it", async () => {
    mockListResult
      .mockResolvedValueOnce({ data: [dishPost('a', 'alice', [dishPhoto('a', 0, 'dish-1', 'Achiote Chicken')]), dishPost('b', 'bob', [dishPhoto('b', 0, 'dish-1', 'Achiote Chicken')]), row('c')], error: null })
      .mockResolvedValueOnce({ data: [{ author_id: 'alice', menu_item_id: 'dish-1', score: 4 }, { author_id: 'bob', menu_item_id: 'dish-1', score: 2 }], error: null });
    const posts = await loadPosts();
    expect(posts.map((p) => p.photos[0].dish)).toEqual([{ name: 'Achiote Chicken', score: 4 }, { name: 'Achiote Chicken', score: 2 }, null]);
    expect(queryCalls('in')).toEqual([['menu_item_id', ['dish-1']], ['author_id', ['alice', 'bob']]]);
  });

  it('gives each photo of one post its own dish and score, and leaves untagged photos without one', async () => {
    mockListResult
      .mockResolvedValueOnce({ data: [dishPost('a', 'alice', [dishPhoto('a', 0, 'dish-1', 'Achiote Chicken'), dishPhoto('a', 1, 'dish-2', 'Mac and Cheese'), photoRow('a', 2)])], error: null })
      .mockResolvedValueOnce({ data: [{ author_id: 'alice', menu_item_id: 'dish-1', score: 4 }, { author_id: 'alice', menu_item_id: 'dish-2', score: 1 }], error: null });
    const [first] = await loadPosts();
    expect(first.photos.map((photo) => photo.dish)).toEqual([{ name: 'Achiote Chicken', score: 4 }, { name: 'Mac and Cheese', score: 1 }, null]);
    expect(queryCalls('in')).toEqual([['menu_item_id', ['dish-1', 'dish-2']], ['author_id', ['alice']]]);
  });

  it('shows the dish without a score when its author has not rated it', async () => {
    mockListResult
      .mockResolvedValueOnce({ data: [dishPost('a', 'alice', [dishPhoto('a', 0, 'dish-1', 'Achiote Chicken')])], error: null })
      .mockResolvedValueOnce({ data: [{ author_id: 'bob', menu_item_id: 'dish-1', score: 5 }], error: null });
    const [first] = await loadPosts();
    expect(first.photos[0].dish).toEqual({ name: 'Achiote Chicken', score: null });
  });

  it('shows free text as the photo\'s dish, with no score and no rating lookup', async () => {
    mockListResult.mockResolvedValue({ data: [dishPost('a', 'alice', [photoRow('a', 0, { dish_text: 'Grandma’s soup' }), photoRow('a', 1)])], error: null });
    const [first] = await loadPosts();
    expect(first.photos.map((photo) => photo.dish)).toEqual([{ name: 'Grandma’s soup', score: null }, null]);
    expect(queryCalls('in')).toEqual([]);
  });

  it('does not look up ratings when no photo has a dish', async () => {
    mockListResult.mockResolvedValue({ data: [row('a')], error: null });
    await loadPosts();
    expect(queryCalls('in')).toEqual([]);
  });

  it('throws when ratings cannot be loaded', async () => {
    const ratingsError = { message: 'permission denied' };
    mockListResult
      .mockResolvedValueOnce({ data: [dishPost('a', 'alice', [dishPhoto('a', 0, 'dish-1', 'Achiote Chicken')])], error: null })
      .mockResolvedValueOnce({ data: null, error: ratingsError });
    await expect(loadPosts()).rejects.toBe(ratingsError);
  });
});

describe('loadPost', () => {
  it('returns null for a missing post without requesting photo links', async () => {
    await expect(loadPost('missing')).resolves.toBeNull();
    expect(queryCalls('eq')).toEqual([['id', 'missing']]);
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });

  it('returns the post with one-hour photo links for all its photos', async () => {
    mockMaybeSingle.mockResolvedValue({ data: row('one', [photoRow('one', 0), photoRow('one', 1)]), error: null });
    mockCreateSignedUrls.mockResolvedValue({ data: [{ signedUrl: 'https://photos/one' }, { signedUrl: 'https://photos/one-1' }], error: null });
    await expect(loadPost('one')).resolves.toEqual({
      ...withoutPhotos, id: 'one', photo_path: 'user-1/one.jpg',
      photos: [{ id: 'one', imageUrl: 'https://photos/one', dish: null }, { id: 'one-1', imageUrl: 'https://photos/one-1', dish: null }],
    });
    expect(mockCreateSignedUrls).toHaveBeenCalledWith(['user-1/one.jpg', 'user-1/one-1.jpg'], 3600);
  });

  it("returns each photo's dish with its author's score", async () => {
    mockMaybeSingle.mockResolvedValue({ data: dishPost('one', 'alice', [dishPhoto('one', 0, 'dish-1', 'Achiote Chicken')]), error: null });
    mockListResult.mockResolvedValue({ data: [{ author_id: 'alice', menu_item_id: 'dish-1', score: 5 }], error: null });
    expect((await loadPost('one'))?.photos[0].dish).toEqual({ name: 'Achiote Chicken', score: 5 });
  });

  it('throws when the query fails', async () => {
    const queryError = { message: 'permission denied' };
    mockMaybeSingle.mockResolvedValue({ data: null, error: queryError });
    await expect(loadPost('one')).rejects.toBe(queryError);
  });

  it('throws when the photo links cannot be created', async () => {
    const photoError = { message: 'storage unavailable' };
    mockMaybeSingle.mockResolvedValue({ data: row('one'), error: null });
    mockCreateSignedUrls.mockResolvedValue({ data: null, error: photoError });
    await expect(loadPost('one')).rejects.toBe(photoError);
  });
});
