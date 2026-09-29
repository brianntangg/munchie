import { useEffect, useState, type PropsWithChildren } from 'react';
import { Banner, Button, LoadingSpinner, Screen } from './ui';
import { ProfileSetup } from './ProfileSetup';
import { message, supabase } from '@/lib/supabase';
export function ProfileGate({ userId, children }: PropsWithChildren<{ userId: string }>) {
  const [status, setStatus] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.resolve(supabase.from('profiles').select('id').eq('id', userId).maybeSingle()).then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      else setStatus(data ? 'ready' : 'missing');
    }).catch((error) => { if (active) setError(message(error)); });
    return () => { active = false; };
  }, [userId, attempt]);
  if (error) return <Screen><Banner message={error} /><Button label="Retry" onPress={() => { setError(''); setAttempt((n) => n + 1); }} /><Button label="Sign out" variant="secondary" onPress={() => { supabase.auth.signOut({ scope: 'local' }).then(({ error }) => { if (error) setError(error.message); }).catch((error) => setError(message(error))); }} /></Screen>;
  if (status === 'loading') return <LoadingSpinner label="Loading profile…" />;
  if (status === 'missing') return <ProfileSetup userId={userId} onSaved={() => setStatus('ready')} />;
  return children;
}
