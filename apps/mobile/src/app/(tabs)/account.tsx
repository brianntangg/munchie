import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';
import { Avatar, Banner, Button, Card } from '@/components/ui';
import { Feed } from '@/components/Feed';
import { useAuth } from '@/lib/auth';
import { message, supabase } from '@/lib/supabase';
import { spacing, type } from '@/theme';
export default function AccountScreen() {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const userId = session?.user.id;
  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let active = true;
    setError('');
    Promise.all([supabase.from('profiles').select('display_name').eq('id', userId).single(), supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', userId)]).then(([profile, posts]) => {
      if (!active) return;
      if (profile.error || posts.error) setError(message(profile.error || posts.error));
      else { setName(profile.data.display_name); setCount(posts.count); }
    }).catch((error) => { if (active) setError(message(error)); });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Changing attempt intentionally reruns the focused request after Retry.
  }, [userId, attempt]));
  async function signOut() {
    setBusy(true); setError('');
    try { const { error } = await supabase.auth.signOut({ scope: 'local' }); if (error) throw error; }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  if (!userId) return null;
  return <Feed authorId={userId} title="My account" header={<>
    <Card style={{ alignItems: 'center', gap: spacing.md }}><Avatar name={name || 'Student'} size={72} /><View style={{ alignItems: 'center' }}><Text style={type.heading}>{name}</Text><Text style={type.caption}>{session.user.email}</Text></View>{count !== null && <Text style={type.body}>{count} posts</Text>}</Card>
    <Banner message={error} />{!!error && <Button label="Retry account" onPress={() => setAttempt((n) => n + 1)} />}<Button label="Sign out" variant="danger" loading={busy} onPress={signOut} /><Text style={type.heading}>My posts</Text>
  </>} />;
}
