// Integration test against local Supabase only. No real emails are sent.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { testProductModel } from './test-product-model.mjs';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key, 'Load apps/mobile/.env.local first');
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname), 'Tests only run against local Supabase');
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const run = randomUUID().slice(0, 8);
async function signIn(label) {
  const api = client();
  const email = `test-${run}-${label}@vanderbilt.edu`;
  const { error } = await api.auth.signInWithOtp({ email });
  assert.ifError(error);
  let code;
  for (let i = 0; i < 20; i++) {
    const response = await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    assert.ok(response.ok, 'Local email inbox is reachable');
    const inbox = await response.json();
    if (inbox.messages?.length) {
      const mail = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${inbox.messages[0].ID}`)).json();
      code = (mail.Text || mail.HTML).match(/\b\d{6}\b/)?.[0];
      if (code) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(code, 'OTP code exists in local email template');
  const verified = await api.auth.verifyOtp({ email, token: code, type: 'email' });
  assert.ifError(verified.error);
  assert.ok(verified.data.session);
  const id = verified.data.user.id;
  assert.ifError((await api.from('profiles').upsert({ id, display_name: `Test ${label}` })).error);
  assert.ifError((await api.from('profiles').upsert({ id, display_name: `Test ${label}` })).error);
  return { api, id };
}
const outsider = await client().auth.signInWithOtp({ email: `test-${run}@example.com` });
assert.ok(outsider.error, 'Non-Vanderbilt signup is denied');
const anonymous = client();
assert.ok((await anonymous.from('posts').select('*')).error, 'Anonymous feed reads are denied');
const alice = await signIn('alice');
const bob = await signIn('bob');
const { data: halls, error: hallError } = await alice.api.from('dining_halls').select('*');
assert.ifError(hallError); assert.ok(halls.length);
const postId = randomUUID();
const path = `${alice.id}/${postId}.jpg`;
// Tiny valid JPEG fixture, uploaded through the actual Storage API.
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==', 'base64');
assert.ok((await bob.api.storage.from('food-photos').upload(path, jpeg, { contentType: 'image/jpeg' })).error, 'Cannot upload into another user folder');
assert.ok((await alice.api.storage.from('food-photos').upload(`${alice.id}/${randomUUID()}.jpg`, Buffer.from('text'), { contentType: 'text/plain' })).error, 'Non-images rejected');
assert.ifError((await alice.api.storage.from('food-photos').upload(path, jpeg, { contentType: 'image/jpeg' })).error);
const post = { id: postId, author_id: alice.id, dining_hall_id: halls[0].id, photo_path: path, caption: 'Integration test' };
assert.ok((await bob.api.from('posts').insert(post)).error, 'Cannot impersonate another author');
assert.ok((await alice.api.from('posts').insert({ ...post, created_at: '2030-01-01T00:00:00Z' })).error, 'Cannot forge feed timestamps');
assert.ok((await alice.api.from('posts').insert({ ...post, caption: 'x'.repeat(281) })).error, 'Caption limit enforced');
assert.ifError((await alice.api.from('posts').insert(post)).error);
const { data: feed, error: feedError } = await bob.api.from('posts').select('*, profiles!inner(display_name), dining_halls!inner(name)').eq('id', postId).single();
assert.ifError(feedError); assert.equal(feed.caption, post.caption); assert.ok(feed.profiles.display_name);
const signed = await bob.api.storage.from('food-photos').createSignedUrl(path, 60);
assert.ifError(signed.error); assert.ok((await fetch(signed.data.signedUrl)).ok, 'Second member can view photo');
assert.ok((await anonymous.storage.from('food-photos').createSignedUrl(path, 60)).error, 'Anonymous photo access denied');
await alice.api.storage.from('food-photos').remove([path]);
assert.ifError((await alice.api.storage.from('food-photos').download(path)).error);
const edit = await bob.api.from('profiles').update({ display_name: 'Impersonator' }).eq('id', alice.id).select();
assert.ifError(edit.error); assert.deepEqual(edit.data, [], 'Cannot edit another profile');
const unused = `${alice.id}/${randomUUID()}.jpg`;
assert.ifError((await alice.api.storage.from('food-photos').upload(unused, jpeg, { contentType: 'image/jpeg' })).error);
assert.ifError((await alice.api.storage.from('food-photos').remove([unused])).error);
assert.ok((await alice.api.storage.from('food-photos').download(unused)).error, 'Unused upload can be cleaned up');
await testProductModel({ alice, bob, halls, jpeg });
assert.ifError((await alice.api.auth.signOut({ scope: 'local' })).error);
assert.ok((await alice.api.from('posts').select('*')).error, 'Sign-out removes access');
console.log('PASS: OTP signup/login, profile, hall list, upload, post, second-user feed/photo, sign-out, and authorization checks.');
console.log(`Demo fixture: ${postId}. Test accounts and three posts remain in the local database.`);
