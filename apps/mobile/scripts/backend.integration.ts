// Backend contract tests against local Supabase: real auth, database, and storage.
// Fixtures are created through member clients, never a service-role key.
// Tests run in file order; later groups build on posts published by earlier ones.
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { client, jpeg, run, signIn, type Member } from './helpers';

let alice: Member;
let bob: Member;
let halls: { id: string; name: string }[];
const anonymous = client();
const longName = 'x'.repeat(40);
const cleanup: { member: () => Member; path: string }[] = [];

const newPhoto = (member: Member) => {
  const id = crypto.randomUUID();
  const path = `${member.id}/${id}.jpg`;
  return { id, path };
};
const upload = async (member: Member, path: string) => {
  const { error } = await member.api.storage.from('food-photos').upload(path, jpeg, { contentType: 'image/jpeg' });
  expect(error).toBeNull();
};

beforeAll(async () => {
  alice = await signIn('alice');
  bob = await signIn('bob');
  const { data, error } = await alice.api.from('dining_halls').select('*');
  expect(error).toBeNull();
  halls = data ?? [];
});

// Policies allow removing only unpublished uploads; published posts and photos remain.
afterAll(async () => {
  for (const { member, path } of cleanup) await member().api.storage.from('food-photos').remove([path]);
});

describe('Sign-in and access', () => {
  test('rejects sign-up with a non-Vanderbilt email', async () => {
    const { error } = await client().auth.signInWithOtp({ email: `test-${run}@example.com` });
    expect(error).not.toBeNull();
  });

  test('denies anonymous feed reads', async () => {
    expect((await anonymous.from('posts').select('*')).error).not.toBeNull();
  });

  test('signs in with an emailed code and saves a profile', async () => {
    const { data, error } = await alice.api.from('profiles').select('display_name').eq('id', alice.id).single();
    expect(error).toBeNull();
    expect(data?.display_name).toBe('Test alice');
  });

  test('members can read the seeded dining halls', () => {
    expect(halls.length).toBeGreaterThanOrEqual(2);
  });

  test("cannot edit another member's profile", async () => {
    const { data, error } = await bob.api.from('profiles').update({ display_name: 'Impersonator' }).eq('id', alice.id).select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe('Menu items', () => {
  test('members can read the seeded menu items with their dining hall', async () => {
    const { data, error } = await alice.api.from('menu_items').select('id, name, dining_halls!inner(name)').limit(5);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.[0].dining_halls).toEqual({ name: expect.any(String) });
  });

  test('denies anonymous menu reads', async () => {
    expect((await anonymous.from('menu_items').select('id')).error).not.toBeNull();
  });

  test('members cannot add menu items', async () => {
    const { error } = await alice.api.from('menu_items').insert({ dining_hall_id: halls[0].id, name: `Test dish ${run}` });
    expect(error?.code).toBe('42501');
  });
});

describe('Profile rules', () => {
  test('rejects blank, whitespace-only, and 41-character display names', async () => {
    for (const display_name of ['', '   ', 'x'.repeat(41)]) {
      const { error } = await alice.api.from('profiles').update({ display_name }).eq('id', alice.id);
      expect(error?.code).toBe('23514');
    }
  });

  test('accepts a 40-character display name', async () => {
    const { data, error } = await alice.api.from('profiles').update({ display_name: longName }).eq('id', alice.id).select().single();
    expect(error).toBeNull();
    expect(data?.display_name).toBe(longName);
  });
});

describe('Photo storage', () => {
  test("cannot upload into another user's folder", async () => {
    const { path } = newPhoto(alice);
    expect((await bob.api.storage.from('food-photos').upload(path, jpeg, { contentType: 'image/jpeg' })).error).not.toBeNull();
  });

  test('rejects non-image uploads', async () => {
    const { path } = newPhoto(alice);
    const text = new TextEncoder().encode('text');
    expect((await alice.api.storage.from('food-photos').upload(path, text, { contentType: 'text/plain' })).error).not.toBeNull();
  });

  test('an unused upload can be removed', async () => {
    const { path } = newPhoto(alice);
    await upload(alice, path);
    expect((await alice.api.storage.from('food-photos').remove([path])).error).toBeNull();
    expect((await alice.api.storage.from('food-photos').download(path)).error).not.toBeNull();
  });
});

describe('Publishing a post', () => {
  const photo = { id: '', path: '' };
  const post = () => ({ id: photo.id, author_id: alice.id, dining_hall_id: halls[0].id, photo_path: photo.path, caption: 'Integration test' });

  beforeAll(async () => {
    Object.assign(photo, newPhoto(alice));
    await upload(alice, photo.path);
  });

  test('cannot post as another author', async () => {
    expect((await bob.api.from('posts').insert(post())).error).not.toBeNull();
  });

  test('cannot forge the post timestamp', async () => {
    expect((await alice.api.from('posts').insert({ ...post(), created_at: '2030-01-01T00:00:00Z' })).error).not.toBeNull();
  });

  test('publishes a post that another member can read with its photo', async () => {
    expect((await alice.api.from('posts').insert(post())).error).toBeNull();
    const { data, error } = await bob.api.from('posts').select('*, profiles!inner(display_name), dining_halls!inner(name)').eq('id', photo.id).single();
    expect(error).toBeNull();
    expect(data.caption).toBe('Integration test');
    const signed = await bob.api.storage.from('food-photos').createSignedUrl(photo.path, 60);
    expect(signed.error).toBeNull();
    expect((await fetch(signed.data!.signedUrl)).ok).toBe(true);
  });

  test('anonymous users cannot get photo links', async () => {
    expect((await anonymous.storage.from('food-photos').createSignedUrl(photo.path, 60)).error).not.toBeNull();
  });

  test('a published photo cannot be removed', async () => {
    await alice.api.storage.from('food-photos').remove([photo.path]);
    expect((await alice.api.storage.from('food-photos').download(photo.path)).error).toBeNull();
  });
});

describe('Post rules', () => {
  const alicePhoto = { id: '', path: '' };
  const bobPhoto = { id: '', path: '' };
  const post = () => ({ id: alicePhoto.id, author_id: alice.id, dining_hall_id: halls[0].id, photo_path: alicePhoto.path });

  beforeAll(() => {
    Object.assign(alicePhoto, newPhoto(alice));
    Object.assign(bobPhoto, newPhoto(bob));
    cleanup.push({ member: () => alice, path: alicePhoto.path }, { member: () => bob, path: bobPhoto.path });
  });

  test('a post must reference an uploaded photo', async () => {
    expect((await alice.api.from('posts').insert(post())).error?.code).toBe('42501');
  });

  describe('with an uploaded photo', () => {
    beforeAll(async () => {
      await upload(alice, alicePhoto.path);
      await upload(bob, bobPhoto.path);
    });

    test('the dining hall must exist', async () => {
      expect((await alice.api.from('posts').insert({ ...post(), dining_hall_id: crypto.randomUUID() })).error?.code).toBe('23503');
    });

    test('the photo path must match the post id', async () => {
      expect((await alice.api.from('posts').insert({ ...post(), id: crypto.randomUUID() })).error?.code).toBe('23514');
    });

    test('captions are limited to 280 characters, and the server sets the timestamp', async () => {
      expect((await alice.api.from('posts').insert({ ...post(), caption: 'x'.repeat(281) })).error?.code).toBe('23514');
      const { data, error } = await alice.api.from('posts').insert({ ...post(), caption: 'x'.repeat(280) }).select().single();
      expect(error).toBeNull();
      expect(data.caption).toHaveLength(280);
      expect(Number.isFinite(Date.parse(data.created_at))).toBe(true);
    });

    test('an omitted caption defaults to an empty string', async () => {
      const { data, error } = await bob.api
        .from('posts')
        .insert({ id: bobPhoto.id, author_id: bob.id, dining_hall_id: halls[1].id, photo_path: bobPhoto.path })
        .select()
        .single();
      expect(error).toBeNull();
      expect(data.caption).toBe('');
    });

    // Limited to this run's posts so existing local demo data cannot affect the results.
    test('the author filter excludes other authors', async () => {
      const { data, error } = await bob.api.from('posts').select('id').in('id', [alicePhoto.id, bobPhoto.id]).eq('author_id', alice.id);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: alicePhoto.id }]);
    });

    test('the hall filter excludes other halls', async () => {
      const { data, error } = await bob.api.from('posts').select('id').in('id', [alicePhoto.id, bobPhoto.id]).eq('dining_hall_id', halls[0].id);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: alicePhoto.id }]);
    });

    test('post detail joins the author and dining hall', async () => {
      const { data, error } = await bob.api.from('posts').select('*, profiles!inner(display_name), dining_halls!inner(name)').eq('id', alicePhoto.id).single();
      expect(error).toBeNull();
      expect(data.profiles.display_name).toBe(longName);
      expect(data.dining_halls.name).toBe(halls[0].name);
      expect(data.photo_path).toBe(alicePhoto.path);
    });

    test('published posts cannot be edited or deleted, even by their author', async () => {
      for (const actor of [alice, bob]) {
        expect((await actor.api.from('posts').update({ caption: 'changed' }).eq('id', alicePhoto.id)).error?.code).toBe('42501');
        expect((await actor.api.from('posts').delete().eq('id', alicePhoto.id)).error?.code).toBe('42501');
      }
      const { data, error } = await bob.api.from('posts').select('caption').eq('id', alicePhoto.id).single();
      expect(error).toBeNull();
      expect(data?.caption).toBe('x'.repeat(280));
    });
  });
});

describe('Sign-out', () => {
  test('signing out removes access', async () => {
    expect((await alice.api.auth.signOut({ scope: 'local' })).error).toBeNull();
    expect((await alice.api.from('posts').select('*')).error).not.toBeNull();
  });
});
