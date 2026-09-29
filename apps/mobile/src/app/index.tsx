import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { isConfigured, message, supabase } from '../lib/supabase';
import { Button, ErrorText, styles } from '../components/ui';
import { SignIn } from '../components/SignIn';
import { ProfileSetup } from '../components/ProfileSetup';
import { Feed } from '../components/Feed';

function MemberHome({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.resolve(supabase.from('profiles').select('id').eq('id', userId).maybeSingle()).then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      else setProfile(data ? 'ready' : 'missing');
    }).catch((error) => { if (active) setError(message(error)); });
    return () => { active = false; };
  }, [userId, attempt]);
  if (error) return <View style={styles.content}><ErrorText>{error}</ErrorText><Button title="Retry" onPress={() => { setError(''); setAttempt((value) => value + 1); }} /></View>;
  if (profile === 'loading') return <ActivityIndicator style={{ margin: 32 }} />;
  if (profile === 'missing') return <ProfileSetup userId={userId} onSaved={() => setProfile('ready')} />;
  return <Feed />;
}
export default function Home() {
  const { session, loading, error } = useAuth();
  if (!isConfigured) return <View style={styles.content}><Text style={styles.title}>Welcome to Munchie</Text><Text style={styles.body}>Local setup is needed. Follow docs/sprint-2.md to start Supabase and configure the app, then restart Expo.</Text></View>;
  if (loading) return <ActivityIndicator style={{ margin: 32 }} />;
  if (!session) return <View style={styles.screen}><ErrorText>{error}</ErrorText><SignIn /></View>;
  return <MemberHome key={session.user.id} userId={session.user.id} />;
}
