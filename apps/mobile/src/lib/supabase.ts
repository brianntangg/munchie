import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const isConfigured = Boolean(url && key);
// The setup screen handles missing configuration without crashing on import.
export const supabase = createClient<Database>(url || 'http://127.0.0.1:54321', key || 'not-configured', {
  auth: { storage: localStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
export function message(error: unknown) {
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Something went wrong. Please try again.';
}
