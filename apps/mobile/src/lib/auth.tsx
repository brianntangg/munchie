import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

// Mock auth for the static prototype. Everything lives in memory and resets on reload.
// When Supabase is wired up, replace the bodies of these functions with Supabase Auth calls;
// the screens only depend on the AuthContextValue shape below.

export type AuthStatus = 'signedOut' | 'unverified' | 'verified';

type AuthContextValue = {
  status: AuthStatus;
  email: string | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  verify: (code: string) => Promise<void>;
  resendCode: () => Promise<void>;
  signOut: () => void;
};

export const MOCK_VERIFICATION_CODE = '123456';
export const DEMO_ACCOUNT = { email: 'demo@vanderbilt.edu', password: 'password123' };

const VANDERBILT_EMAIL = /^[^\s@]+@vanderbilt\.edu$/i;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required.';
  if (!VANDERBILT_EMAIL.test(email.trim())) return 'Use your @vanderbilt.edu email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

const delay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

type MockUser = { password: string; verified: boolean };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users] = useState(
    () => new Map<string, MockUser>([[DEMO_ACCOUNT.email, { password: DEMO_ACCOUNT.password, verified: true }]]),
  );
  const [status, setStatus] = useState<AuthStatus>('signedOut');
  const [email, setEmail] = useState<string | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      email,
      async signUp(rawEmail, password) {
        const normalized = rawEmail.trim().toLowerCase();
        const error = validateEmail(normalized) ?? validatePassword(password);
        if (error) throw new Error(error);
        await delay();
        if (users.has(normalized)) throw new Error('An account with this email already exists. Try logging in.');
        users.set(normalized, { password, verified: false });
        setEmail(normalized);
        setStatus('unverified');
      },
      async signIn(rawEmail, password) {
        const normalized = rawEmail.trim().toLowerCase();
        const error = validateEmail(normalized);
        if (error) throw new Error(error);
        await delay();
        const user = users.get(normalized);
        if (!user || user.password !== password) throw new Error('Invalid email or password.');
        setEmail(normalized);
        setStatus(user.verified ? 'verified' : 'unverified');
      },
      async verify(code) {
        await delay();
        if (code.trim() !== MOCK_VERIFICATION_CODE) throw new Error('That code is incorrect or has expired.');
        const user = email ? users.get(email) : undefined;
        if (user) user.verified = true;
        setStatus('verified');
      },
      async resendCode() {
        await delay();
      },
      signOut() {
        setEmail(null);
        setStatus('signedOut');
      },
    }),
    [status, email, users],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
