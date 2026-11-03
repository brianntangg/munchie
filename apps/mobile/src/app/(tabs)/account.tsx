import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';
import { Avatar, Banner, Button, Card } from '@/components/ui';
import { Feed } from '@/components/Feed';
import { ProfileStats } from '@/components/ProfileStats';
import { useAuth } from '@/lib/auth';
import { loadProfile, type Profile } from '@/lib/profiles';
import { message, supabase } from '@/lib/supabase';
import { spacing, type } from '@/theme';
export default function AccountScreen() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const userId = session?.user.id;
  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let active = true;
    setError('');
    loadProfile(userId).then((next) => { if (active) setProfile(next); }).catch((error) => { if (active) setError(message(error)); });
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
    <Card style={{ alignItems: 'center', gap: spacing.md }}><Avatar name={profile?.displayName || 'Student'} size={72} /><View style={{ alignItems: 'center' }}><Text style={type.heading}>{profile?.displayName ?? ''}</Text><Text style={type.caption}>{session.user.email}</Text></View>{profile && <ProfileStats profile={profile} />}</Card>
    <Banner message={error} />{!!error && <Button label="Retry account" onPress={() => setAttempt((n) => n + 1)} />}<Button label="Sign out" variant="danger" loading={busy} onPress={signOut} /><Text style={type.heading}>My posts</Text>
  </>} />;
}
