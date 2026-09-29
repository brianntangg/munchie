import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { isConfigured, message, supabase } from './supabase';

const AuthContext = createContext<{ session: Session | null; loading: boolean; error: string }>({ session: null, loading: true, error: '' });
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isConfigured);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isConfigured) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setLoading(false); }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) { setSession(data.session); setError(error?.message || ''); setLoading(false); }
    }).catch((error) => { if (active) { setError(message(error)); setLoading(false); } });
    const refresh = (state: string) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    refresh(AppState.currentState);
    const appState = AppState.addEventListener('change', refresh);
    return () => { active = false; subscription.unsubscribe(); appState.remove(); supabase.auth.stopAutoRefresh(); };
  }, []);
  return <AuthContext.Provider value={{ session, loading, error }}>{children}</AuthContext.Provider>;
}
