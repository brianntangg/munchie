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

describe('Dining hall hours', () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const readHours = (member: Member) => member.api.from('dining_halls').select('id, name, hours').order('name');

  test('members can read every hall\'s weekly hours', async () => {
    const { data, error } = await alice.api.from('dining_halls').select('id, name, hours').order('name');
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    for (const hall of data!) {
      expect(Object.keys(hall.hours ?? {}).sort()).toEqual([...days].sort());
      for (const shifts of Object.values(hall.hours) as string[][][]) {
        for (const [open, close] of shifts) {
          expect(open).toMatch(/^\d{2}:\d{2}$/);
          expect(close).toMatch(/^\d{2}:\d{2}$/);
        }
      }
    }
  });

  test('members cannot change a hall\'s hours, and they stay as they were', async () => {
    const { data: before } = await readHours(alice);
    const hall = before![0];
    for (const actor of [alice, bob]) {
      expect((await actor.api.from('dining_halls').update({ hours: null }).eq('id', hall.id)).error?.code).toBe('42501');
      expect((await actor.api.from('dining_halls').update({ hours: { Monday: [] } }).eq('id', hall.id)).error?.code).toBe('42501');
    }
    const { data: after } = await readHours(bob);
    expect(after).toEqual(before);
  });

  test('members cannot add or remove halls', async () => {
    expect((await alice.api.from('dining_halls').insert({ name: `Test hall ${run}`, hours: null })).error?.code).toBe('42501');
    expect((await alice.api.from('dining_halls').delete().eq('id', halls[0].id)).error?.code).toBe('42501');
  });

  test('denies anonymous hours reads', async () => {
    expect((await anonymous.from('dining_halls').select('hours')).error).not.toBeNull();
  });
});

describe('Menu items', () => {
  test('members can read the seeded menu items with their dining hall', async () => {
    const { data, error } = await alice.api.from('menu_items').select('id, name, dining_halls!inner(name)').limit(5);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.[0].dining_halls).toEqual({ name: expect.any(String) });
  });

  // Same query as loadMenuItems in src/lib/menu.ts, which the dish picker on the new-post screen uses.
  test("lists one hall's dishes ordered by station then name", async () => {
    const hall = halls.find((candidate) => candidate.name === 'Rand')!;
    const { data, error } = await alice.api.from('menu_items').select('id, name, category').eq('dining_hall_id', hall.id).order('category').order('name');
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    const keys = data!.map((dish) => `${dish.category ?? '\uffff'}|${dish.name}`);
    expect(keys).toEqual([...keys].sort());
  });

  test('denies anonymous menu reads', async () => {
    expect((await anonymous.from('menu_items').select('id')).error).not.toBeNull();
  });

  test('members cannot add menu items', async () => {
    const { error } = await alice.api.from('menu_items').insert({ dining_hall_id: halls[0].id, name: `Test dish ${run}` });
    expect(error?.code).toBe('42501');
  });
});

describe('Popular dishes', () => {
  // The call behind the starter suggestions on the photo screen (loadPopularDishes in src/lib/menu.ts).
  test('a member gets a hall\'s rated dishes, most-rated first, limited to what they ask for', async () => {
    const rand = halls.find((candidate) => candidate.name === 'Rand')!;
    const { data: menu, error: menuError } = await alice.api.from('menu_items').select('id').eq('dining_hall_id', rand.id).order('name').limit(2);
    expect(menuError).toBeNull();
    expect(menu).toHaveLength(2);
    // A separate member rates them, so the Ratings tests below still make Alice's and Bob's first ratings.
    const carol = await signIn('carol');
    for (const dish of menu!) expect((await carol.api.from('ratings').insert({ menu_item_id: dish.id, score: 4 })).error).toBeNull();
    const { data, error } = await alice.api.rpc('popular_dishes', { hall_id: rand.id, max_results: 50 });
    expect(error).toBeNull();
    expect(Object.keys(data![0]).sort()).toEqual(['category', 'id', 'name']);
    const ids = data!.map((dish: { id: string }) => dish.id);
    expect(ids).toEqual(expect.arrayContaining([menu![0].id, menu![1].id]));
    // Other tests rate dishes too, so check the order against the actual counts rather than fixed positions.
    const { data: ratings } = await alice.api.from('ratings').select('menu_item_id').in('menu_item_id', ids);
    const counts = ids.map((id: string) => ratings!.filter((rating) => rating.menu_item_id === id).length);
    expect(counts.every((count: number) => count > 0)).toBe(true);
    expect(counts).toEqual([...counts].sort((x, y) => y - x));
    const { data: inHall } = await alice.api.from('menu_items').select('id').eq('dining_hall_id', rand.id).in('id', ids);
    expect(inHall).toHaveLength(ids.length);
    const { data: one } = await alice.api.rpc('popular_dishes', { hall_id: rand.id, max_results: 1 });
    expect(one).toHaveLength(1);
  });

  test('✗ denies anonymous callers', async () => {
    const { error } = await anonymous.rpc('popular_dishes', { hall_id: halls[0].id });
    expect(error).not.toBeNull();
  });
});

describe('Ratings', () => {
  let dish: string;
  const myScore = async (member: Member) => {
    const { data, error } = await member.api.from('ratings').select('score').eq('author_id', member.id).eq('menu_item_id', dish);
    expect(error).toBeNull();
    return data?.map((row) => row.score);
  };

  beforeAll(async () => {
    const { data, error } = await alice.api.from('menu_items').select('id').limit(1).single();
    expect(error).toBeNull();
    dish = data!.id;
  });

  test('a member can rate a dish and read the rating back', async () => {
    expect((await alice.api.from('ratings').insert({ menu_item_id: dish, score: 4 })).error).toBeNull();
    expect(await myScore(alice)).toEqual([4]);
  });

  test('rating the same dish again updates the score instead of adding a second rating', async () => {
    expect((await alice.api.from('ratings').insert({ menu_item_id: dish, score: 2 })).error?.code).toBe('23505');
    expect((await alice.api.from('ratings').update({ score: 2 }).eq('menu_item_id', dish)).error).toBeNull();
    expect(await myScore(alice)).toEqual([2]);
  });

  test("members see each other's ratings, so a dish can be averaged", async () => {
    expect((await bob.api.from('ratings').insert({ menu_item_id: dish, score: 5 })).error).toBeNull();
    const { data, error } = await alice.api.from('ratings').select('score').eq('menu_item_id', dish).in('author_id', [alice.id, bob.id]);
    expect(error).toBeNull();
    const scores = (data ?? []).map((row) => row.score);
    expect(scores.reduce((sum, score) => sum + score, 0) / scores.length).toBe(3.5);
  });

  test("a member's update cannot change someone else's rating", async () => {
    expect((await bob.api.from('ratings').update({ score: 1 }).eq('menu_item_id', dish).eq('author_id', alice.id)).error).toBeNull();
    expect(await myScore(alice)).toEqual([2]);
  });

  test('rejects scores outside 1-5 and non-whole scores', async () => {
    const { data, error } = await alice.api.from('menu_items').select('id').neq('id', dish).limit(1).single();
    expect(error).toBeNull();
    expect((await alice.api.from('ratings').insert({ menu_item_id: data!.id, score: 6 })).error?.code).toBe('23514');
    expect((await alice.api.from('ratings').insert({ menu_item_id: data!.id, score: 0 })).error?.code).toBe('23514');
    expect((await alice.api.from('ratings').insert({ menu_item_id: data!.id, score: 3.5 })).error).not.toBeNull();
  });

  test('cannot rate as another member', async () => {
    const { error } = await alice.api.from('ratings').insert({ menu_item_id: dish, score: 3, author_id: bob.id });
    expect(error?.code).toBe('42501');
  });

  test('denies anonymous rating reads', async () => {
    expect((await anonymous.from('ratings').select('id')).error).not.toBeNull();
  });
});

describe('Profile rules', () => {
  test("members can read another member's profile and post count", async () => {
    const [profile, posts] = await Promise.all([
      bob.api.from('profiles').select('id, display_name').eq('id', alice.id).maybeSingle(),
      bob.api.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', alice.id),
    ]);
    expect(profile.error).toBeNull();
    expect(profile.data?.id).toBe(alice.id);
    expect(posts.error).toBeNull();
    expect(posts.count).toEqual(expect.any(Number));
  });

  test('denies anonymous profile reads', async () => {
    expect((await anonymous.from('profiles').select('*')).error).not.toBeNull();
  });

  test('follower and following counts change after a follow and an unfollow', async () => {
    const counts = async () => {
      const [followers, following] = await Promise.all([
        alice.api.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', alice.id),
        bob.api.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', bob.id),
      ]);
      expect(followers.error).toBeNull();
      expect(following.error).toBeNull();
      return [followers.count, following.count];
    };
    const [followersBefore, followingBefore] = await counts();
    expect((await bob.api.from('follows').insert({ followee_id: alice.id })).error).toBeNull();
    expect(await counts()).toEqual([followersBefore! + 1, followingBefore! + 1]);
    expect((await bob.api.from('follows').delete().eq('followee_id', alice.id)).error).toBeNull();
    expect(await counts()).toEqual([followersBefore, followingBefore]);
  });

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
      const { data, error } = await bob.api.from('posts').select('*, profiles!inner(display_name), dining_halls!inner(name), menu_items(name)').eq('id', alicePhoto.id).single();
      expect(error).toBeNull();
      expect(data.menu_items).toBeNull(); // this post names no dish
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

describe('Posts about a dish', () => {
  const photo = { id: '', path: '' };
  let dishInHall: string;
  let dishElsewhere: string;
  // The post select the feed uses (POST_COLUMNS in src/lib/posts.ts), and the lookup of the author's own rating.
  const feedSelect = '*, profiles!inner(display_name), dining_halls!inner(name), menu_items(name)';

  // Seeded dishes, picked by name: one at Rand for the post, one at Commons to prove it cannot be used for a Rand post.
  // (The Ratings tests above rate whichever dish comes back first, so these are chosen to be different dishes.)
  const dishId = async (hallName: string, dishName: string) => {
    const hall = halls.find((candidate) => candidate.name === hallName)!;
    const { data, error } = await bob.api.from('menu_items').select('id').eq('dining_hall_id', hall.id).eq('name', dishName).single();
    expect(error).toBeNull();
    return data!.id as string;
  };

  beforeAll(async () => {
    dishInHall = await dishId('Rand', 'Sweet Potato Sofrito');
    dishElsewhere = await dishId('Commons', 'Beef Lasagna');
    Object.assign(photo, newPhoto(bob));
    cleanup.push({ member: () => bob, path: photo.path });
    await upload(bob, photo.path);
  });

  const post = (hallName: string, dish: string | null) => ({ id: photo.id, author_id: bob.id, dining_hall_id: halls.find((candidate) => candidate.name === hallName)!.id, photo_path: photo.path, menu_item_id: dish });

  test('a post cannot name a dish from a different hall', async () => {
    expect((await bob.api.from('posts').insert(post('Rand', dishElsewhere))).error?.code).toBe('23503');
  });

  test('a post names a dish served at its hall, and the feed joins its name', async () => {
    expect((await bob.api.from('posts').insert(post('Rand', dishInHall))).error).toBeNull();
    const { data, error } = await alice.api.from('posts').select(feedSelect).eq('id', photo.id).single();
    expect(error).toBeNull();
    expect(data.menu_items).toEqual({ name: expect.any(String) });
  });

  test("the feed can look up the author's own score for the dish", async () => {
    expect((await bob.api.from('ratings').insert({ menu_item_id: dishInHall, score: 4 })).error).toBeNull();
    expect((await alice.api.from('ratings').insert({ menu_item_id: dishInHall, score: 2 })).error).toBeNull();
    const { data, error } = await alice.api.from('ratings').select('author_id, menu_item_id, score').in('menu_item_id', [dishInHall]).in('author_id', [bob.id]);
    expect(error).toBeNull();
    expect(data).toEqual([{ author_id: bob.id, menu_item_id: dishInHall, score: 4 }]);
  });
});

describe('Posts with several photos', () => {
  const cover = { id: '', path: '' };
  const extras = Array.from({ length: 5 }, () => ({ id: '', path: '' }));
  let rand: { id: string; name: string };
  let dishes: { id: string; name: string }[];
  // The post select the feed uses (POST_COLUMNS in src/lib/posts.ts).
  const feedSelect = '*, profiles!inner(display_name), dining_halls!inner(name), post_photos(id, slot, photo_path, menu_item_id, dish_text, menu_items(name))';
  // What publishPost in src/lib/posts.ts attaches after the post itself: extra photos in slots 1 and up, in one request.
  const attach = (member: Member, count: number, tags: (string | null)[] = []) => member.api.from('post_photos').upsert(
    extras.slice(0, count).map((photo, index) => ({ id: photo.id, post_id: cover.id, dining_hall_id: rand.id, slot: index + 1, photo_path: photo.path, ...(tags[index] ? { menu_item_id: tags[index] } : {}) })),
    { onConflict: 'id', ignoreDuplicates: true },
  );

  beforeAll(async () => {
    rand = halls.find((candidate) => candidate.name === 'Rand')!;
    const { data, error } = await alice.api.from('menu_items').select('id, name').eq('dining_hall_id', rand.id).order('name').limit(3);
    expect(error).toBeNull();
    dishes = data ?? [];
    expect(dishes.length).toBe(3);
    for (const photo of [cover, ...extras]) {
      Object.assign(photo, newPhoto(alice));
      cleanup.push({ member: () => alice, path: photo.path });
      await upload(alice, photo.path);
    }
  });

  test('publishing a post records its cover photo and dish', async () => {
    const { error } = await alice.api.from('posts').insert({ id: cover.id, author_id: alice.id, dining_hall_id: rand.id, photo_path: cover.path, menu_item_id: dishes[0].id });
    expect(error).toBeNull();
    const { data, error: readError } = await bob.api.from('post_photos').select('id, slot, menu_item_id').eq('post_id', cover.id);
    expect(readError).toBeNull();
    expect(data).toEqual([{ id: cover.id, slot: 0, menu_item_id: dishes[0].id }]);
  });

  test('the author attaches extra photos tagged with other dishes, and a retry changes nothing', async () => {
    expect((await attach(alice, 2, [dishes[1].id, null])).error).toBeNull();
    expect((await attach(alice, 2, [dishes[1].id, null])).error).toBeNull();
    const { data, error } = await bob.api.from('post_photos').select('id').eq('post_id', cover.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(3);
  });

  test('the feed returns every photo of the post with its dish name', async () => {
    const { data, error } = await bob.api.from('posts').select(feedSelect).eq('id', cover.id).single();
    expect(error).toBeNull();
    const photos = [...data.post_photos].sort((a: { slot: number }, b: { slot: number }) => a.slot - b.slot);
    expect(photos.map((photo: { slot: number; menu_items: { name: string } | null }) => [photo.slot, photo.menu_items?.name ?? null])).toEqual([[0, dishes[0].name], [1, dishes[1].name], [2, null]]);
  });

  test('the same dish cannot be tagged on two photos of one post', async () => {
    const { error } = await alice.api.from('post_photos').insert({ id: extras[2].id, post_id: cover.id, dining_hall_id: rand.id, slot: 3, photo_path: extras[2].path, menu_item_id: dishes[0].id });
    expect(error?.code).toBe('23505');
  });

  test('a photo can be labeled with free text instead of a menu dish, but not both', async () => {
    const row = { id: extras[2].id, post_id: cover.id, dining_hall_id: rand.id, slot: 3, photo_path: extras[2].path };
    expect((await alice.api.from('post_photos').insert({ ...row, menu_item_id: dishes[2].id, dish_text: 'Both' })).error?.code).toBe('23514');
    expect((await alice.api.from('post_photos').insert({ ...row, dish_text: '   ' })).error?.code).toBe('23514');
    expect((await alice.api.from('post_photos').insert({ ...row, dish_text: 'Grandma’s soup' })).error).toBeNull();
    const { data, error } = await bob.api.from('posts').select(feedSelect).eq('id', cover.id).single();
    expect(error).toBeNull();
    expect(data.post_photos.find((photo: { slot: number }) => photo.slot === 3)).toMatchObject({ dish_text: 'Grandma’s soup', menu_item_id: null, menu_items: null });
  });

  test('a post cannot have a sixth photo', async () => {
    const { error } = await alice.api.from('post_photos').insert({ id: extras[2].id, post_id: cover.id, dining_hall_id: rand.id, slot: 5, photo_path: extras[2].path });
    expect(error?.code).toBe('23514');
  });

  test("another member cannot add photos to someone else's post", async () => {
    const { error } = await attach(bob, 3);
    expect(error?.code).toBe('42501');
  });

  test('published photos cannot be changed or removed', async () => {
    expect((await alice.api.from('post_photos').update({ menu_item_id: dishes[2].id }).eq('id', extras[0].id)).error?.code).toBe('42501');
    expect((await alice.api.from('post_photos').delete().eq('id', extras[0].id)).error?.code).toBe('42501');
  });

  test('an attached photo cannot be deleted from storage, but an unattached upload can', async () => {
    const attached = await alice.api.storage.from('food-photos').remove([extras[0].path]);
    expect(attached.data ?? []).toHaveLength(0);
    const unattached = await alice.api.storage.from('food-photos').remove([extras[4].path]);
    expect(unattached.error).toBeNull();
    expect(unattached.data).toHaveLength(1);
  });
});

describe('Likes and comments', () => {
  let post: string;
  const likeCount = async () => {
    const { count, error } = await bob.api.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post);
    expect(error).toBeNull();
    return count;
  };

  beforeAll(async () => {
    const { data, error } = await alice.api.from('posts').select('id').eq('author_id', alice.id).limit(1).single();
    expect(error).toBeNull();
    post = data!.id;
  });

  test('like counts change after a like and an unlike', async () => {
    const before = await likeCount();
    expect((await bob.api.from('likes').insert({ post_id: post })).error).toBeNull();
    expect(await likeCount()).toBe(before! + 1);
    expect((await bob.api.from('likes').delete().eq('post_id', post)).error).toBeNull();
    expect(await likeCount()).toBe(before);
  });

  test('a member can like a post only once', async () => {
    expect((await bob.api.from('likes').insert({ post_id: post })).error).toBeNull();
    expect((await bob.api.from('likes').insert({ post_id: post })).error?.code).toBe('23505');
  });

  test("cannot like as another member or remove someone else's like", async () => {
    expect((await alice.api.from('likes').insert({ post_id: post, author_id: bob.id })).error?.code).toBe('42501');
    // Make sure bob's like exists here rather than relying on the previous test (a duplicate is fine).
    const { error } = await bob.api.from('likes').insert({ post_id: post });
    expect([undefined, '23505']).toContain(error?.code);
    const bobsLike = () => bob.api.from('likes').select('post_id').eq('post_id', post).eq('author_id', bob.id);
    expect((await bobsLike()).data).toHaveLength(1);
    expect((await alice.api.from('likes').delete().eq('post_id', post).eq('author_id', bob.id)).error).toBeNull();
    expect((await bobsLike()).data).toHaveLength(1);
    // Clean up, so later tests that count likes start from what they expect.
    expect((await bob.api.from('likes').delete().eq('post_id', post)).error).toBeNull();
    expect((await bobsLike()).data).toHaveLength(0);
  });

  test("comments come back oldest first with each author's name", async () => {
    expect((await bob.api.from('comments').insert({ post_id: post, body: 'First' })).error).toBeNull();
    expect((await alice.api.from('comments').insert({ post_id: post, body: 'Second' })).error).toBeNull();
    const { data, error } = await bob.api.from('comments').select('body, profiles(display_name)')
      .eq('post_id', post).order('created_at').order('id');
    expect(error).toBeNull();
    expect(data?.slice(-2)).toEqual([
      { body: 'First', profiles: { display_name: expect.any(String) } },
      { body: 'Second', profiles: { display_name: longName } },
    ]);
  });

  test('rejects blank, whitespace-only, and 281-character comments', async () => {
    for (const body of ['   ', '\n\t', 'x'.repeat(281), `Hi${' '.repeat(300)}`]) {
      expect((await bob.api.from('comments').insert({ post_id: post, body })).error?.code).toBe('23514');
    }
  });

  test("a member can delete their own comment but not someone else's", async () => {
    const { data, error } = await bob.api.from('comments').insert({ post_id: post, body: 'Delete me' }).select('id').single();
    expect(error).toBeNull();
    await alice.api.from('comments').delete().eq('id', data!.id);
    expect((await bob.api.from('comments').select('id').eq('id', data!.id)).data).toHaveLength(1);
    expect((await bob.api.from('comments').delete().eq('id', data!.id)).error).toBeNull();
    expect((await bob.api.from('comments').select('id').eq('id', data!.id)).data).toHaveLength(0);
  });

  test('denies anonymous like and comment reads', async () => {
    expect((await anonymous.from('likes').select('post_id')).error).not.toBeNull();
    expect((await anonymous.from('comments').select('id')).error).not.toBeNull();
  });
});

describe('Sign-out', () => {
  test('signing out removes access', async () => {
    expect((await alice.api.auth.signOut({ scope: 'local' })).error).toBeNull();
    expect((await alice.api.from('posts').select('*')).error).not.toBeNull();
  });
});
