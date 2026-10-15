// Shared setup for backend integration tests against local Supabase only. No real emails are sent.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Read through a local reference: Expo's Babel preset rewrites direct process.env.EXPO_PUBLIC_* reads for the app bundle.
const env = process.env;
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Load apps/mobile/.env.local first');
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Tests only run against local Supabase');

export const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
export const run = crypto.randomUUID().slice(0, 8);
export type Member = { api: SupabaseClient; id: string };

// Requests a sign-in code, reads it from the local captured inbox, and verifies it.
export async function signIn(label: string): Promise<Member> {
  const api = client();
  const email = `test-${run}-${label}@vanderbilt.edu`;
  const { error } = await api.auth.signInWithOtp({ email });
  if (error) throw error;
  let code: string | undefined;
  for (let i = 0; i < 20 && !code; i++) {
    const response = await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    if (!response.ok) throw new Error('Local email inbox is not reachable');
    const inbox = await response.json();
    if (inbox.messages?.length) {
      const mail = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${inbox.messages[0].ID}`)).json();
      code = (mail.Text || mail.HTML).match(/\b\d{6}\b/)?.[0];
    }
    if (!code) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!code) throw new Error(`No sign-in code arrived for ${email}`);
  const verified = await api.auth.verifyOtp({ email, token: code, type: 'email' });
  if (verified.error) throw verified.error;
  const id = verified.data.user!.id;
  // Saving twice confirms profile creation is safe to retry.
  for (let i = 0; i < 2; i++) {
    const saved = await api.from('profiles').upsert({ id, display_name: `Test ${label}` });
    if (saved.error) throw saved.error;
  }
  return { api, id };
}

// Tiny valid JPEG fixture, uploaded through the actual Storage API.
export const jpeg = Uint8Array.from(
  atob('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q=='),
  (char) => char.charCodeAt(0),
);
