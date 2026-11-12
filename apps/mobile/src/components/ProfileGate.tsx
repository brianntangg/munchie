import { useEffect, useState, type PropsWithChildren } from 'react';
import { Banner, Button, LoadingSpinner, Screen } from './ui';
import { ProfileSetup } from './ProfileSetup';
import { message, supabase } from '@/lib/supabase';
// Shows the app only once the member has a profile, asking new members for a name first. `onName` gets the member's
// display name as soon as it is known: when an existing profile loads, or right after a new member saves one.
export function ProfileGate({ userId, onName, children }: PropsWithChildren<{ userId: string; onName?: (name: string) => void }>) {
  const [status, setStatus] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.resolve(supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle()).then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      else if (data) { onName?.(data.display_name); setStatus('ready'); }
      else setStatus('missing');
    }).catch((error) => { if (active) setError(message(error)); });
    return () => { active = false; };
  }, [userId, attempt, onName]);
  if (error) return <Screen><Banner message={error} /><Button label="Retry" onPress={() => { setError(''); setAttempt((n) => n + 1); }} /><Button label="Sign out" variant="secondary" onPress={() => { supabase.auth.signOut({ scope: 'local' }).then(({ error }) => { if (error) setError(error.message); }).catch((error) => setError(message(error))); }} /></Screen>;
  if (status === 'loading') return <LoadingSpinner label="Loading profile…" />;
  if (status === 'missing') return <ProfileSetup userId={userId} onSaved={(name) => { onName?.(name); setStatus('ready'); }} />;
  return children;
}
