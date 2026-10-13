import { afterEach, describe, expect, it, jest } from '@jest/globals';

// Native storage and the real client are replaced; these tests check configuration only.
jest.mock('expo-sqlite/localStorage/install', () => {
  // Like the real module, provide the global storage the client is configured with.
  Object.assign(globalThis, { localStorage: {} });
  return {};
});
const mockCreateClient = jest.fn((..._args: unknown[]) => ({}));
jest.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => mockCreateClient(...args) }));

const originalEnv = process.env;
afterEach(() => {
  process.env = originalEnv;
  mockCreateClient.mockClear();
});

// The module reads environment variables when it is first imported, so each test loads a fresh copy.
function loadWithEnv(url?: string, key?: string): typeof import('../supabase') {
  process.env = { ...originalEnv, EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key };
  let loaded!: typeof import('../supabase');
  jest.isolateModules(() => {
    // Jest reloads modules synchronously; dynamic import() would need experimental VM modules.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('../supabase');
  });
  return loaded;
}

describe('Supabase configuration', () => {
  it('uses the configured URL and key', () => {
    const { isConfigured } = loadWithEnv('https://project.supabase.co', 'publishable-key');
    expect(isConfigured).toBe(true);
    expect(mockCreateClient.mock.calls[0].slice(0, 2)).toEqual(['https://project.supabase.co', 'publishable-key']);
  });

  it('reports missing configuration and falls back to placeholders without crashing', () => {
    const { isConfigured } = loadWithEnv(undefined, undefined);
    expect(isConfigured).toBe(false);
    expect(mockCreateClient.mock.calls[0].slice(0, 2)).toEqual(['http://127.0.0.1:54321', 'not-configured']);
  });

  it('is not configured when only the URL is set', () => {
    expect(loadWithEnv('https://project.supabase.co', undefined).isConfigured).toBe(false);
  });
});

describe('message', () => {
  const { message } = loadWithEnv('https://project.supabase.co', 'publishable-key');

  it('returns the message of an error object', () => {
    expect(message(new Error('Invalid code'))).toBe('Invalid code');
    expect(message({ message: 'Row-level security violation' })).toBe('Row-level security violation');
  });

  it('falls back to a generic message for anything else', () => {
    for (const error of [null, undefined, 'text error', { code: '500' }]) {
      expect(message(error)).toBe('Something went wrong. Please try again.');
    }
  });
});
