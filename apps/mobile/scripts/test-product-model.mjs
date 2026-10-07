// Real database/storage contract checks, called by test-backend.mjs.
// Fixtures are created through member clients, never through a service-role key.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function testProductModel({ alice, bob, halls, jpeg }) {
  assert.ok(halls.length >= 2, 'Model tests require two seeded dining halls');
  for (const display_name of ['', '   ', 'x'.repeat(41)]) {
    const result = await alice.api.from('profiles').update({ display_name }).eq('id', alice.id);
    assert.equal(result.error?.code, '23514', 'Invalid display names violate the database constraint');
  }
  const name = 'x'.repeat(40);
  const profile = await alice.api.from('profiles').update({ display_name: name }).eq('id', alice.id).select().single();
  assert.ifError(profile.error);
  assert.equal(profile.data.display_name, name, 'A 40-character display name is accepted');

  const id = randomUUID();
  const photo_path = `${alice.id}/${id}.jpg`;
  const post = { id, author_id: alice.id, dining_hall_id: halls[0].id, photo_path };
  const missingPhoto = await alice.api.from('posts').insert(post);
  assert.equal(missingPhoto.error?.code, '42501', 'Posts must reference an uploaded photo');
  assert.ifError((await alice.api.storage.from('food-photos').upload(photo_path, jpeg, { contentType: 'image/jpeg' })).error);
  try {
    const missingHall = await alice.api.from('posts').insert({ ...post, dining_hall_id: randomUUID() });
    assert.equal(missingHall.error?.code, '23503', 'Hall must exist');
    const mismatchedPath = await alice.api.from('posts').insert({ ...post, id: randomUUID() });
    assert.equal(mismatchedPath.error?.code, '23514', 'Photo path must match the post ID');
    const longCaption = await alice.api.from('posts').insert({ ...post, caption: 'x'.repeat(281) });
    assert.equal(longCaption.error?.code, '23514', 'A 281-character caption is rejected');
    const inserted = await alice.api.from('posts').insert({ ...post, caption: 'x'.repeat(280) }).select().single();
    assert.ifError(inserted.error);
    assert.equal(inserted.data.caption.length, 280, 'A 280-character caption is accepted');
    assert.ok(Number.isFinite(Date.parse(inserted.data.created_at)), 'Server supplies a timestamp');

    const otherId = randomUUID();
    const otherPath = `${bob.id}/${otherId}.jpg`;
    assert.ifError((await bob.api.storage.from('food-photos').upload(otherPath, jpeg, { contentType: 'image/jpeg' })).error);
    try {
      const optionalCaption = await bob.api.from('posts').insert({
        id: otherId, author_id: bob.id, dining_hall_id: halls[1].id, photo_path: otherPath,
      }).select().single();
      assert.ifError(optionalCaption.error);
      assert.equal(optionalCaption.data.caption, '', 'Omitted caption defaults to an empty string');

      // Limit to this run's IDs so existing local demo data cannot affect assertions.
      const byAuthor = await bob.api.from('posts').select('id').in('id', [id, otherId]).eq('author_id', alice.id);
      assert.ifError(byAuthor.error);
      assert.deepEqual(byAuthor.data, [{ id }], 'Account filter excludes other authors');
      const byHall = await bob.api.from('posts').select('id').in('id', [id, otherId]).eq('dining_hall_id', halls[0].id);
      assert.ifError(byHall.error);
      assert.deepEqual(byHall.data, [{ id }], 'Dining filter excludes other halls');
      const detail = await bob.api.from('posts').select('*, profiles!inner(display_name), dining_halls!inner(name)').eq('id', id).single();
      assert.ifError(detail.error);
      assert.equal(detail.data.profiles.display_name, name, 'Detail joins the stored author profile');
      assert.equal(detail.data.dining_halls.name, halls[0].name, 'Detail joins the stored hall');
      assert.equal(detail.data.photo_path, photo_path);

      for (const actor of [alice, bob]) {
        const edit = await actor.api.from('posts').update({ caption: 'changed' }).eq('id', id);
        assert.equal(edit.error?.code, '42501', 'Even the author cannot edit published posts');
        const remove = await actor.api.from('posts').delete().eq('id', id);
        assert.equal(remove.error?.code, '42501', 'Even the author cannot delete published posts');
      }
      const unchanged = await bob.api.from('posts').select('caption').eq('id', id).single();
      assert.ifError(unchanged.error);
      assert.equal(unchanged.data.caption, 'x'.repeat(280), 'Rejected mutations preserve the post');
    } finally {
      // Policies allow removing only unpublished uploads; successful posts remain.
      await bob.api.storage.from('food-photos').remove([otherPath]);
    }
  } finally {
    await alice.api.storage.from('food-photos').remove([photo_path]);
  }
  console.log('PASS: real product model boundaries, relationships, defaults, author/hall filters, joins, and immutable posts.');
}
