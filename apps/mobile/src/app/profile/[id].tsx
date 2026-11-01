import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { Feed } from '@/components/Feed';
import { Avatar, Banner, Button, Card, Screen } from '@/components/ui';
import { ProfileStats } from '@/components/ProfileStats';
import { loadProfile, type Profile } from '@/lib/profiles';
import { message } from '@/lib/supabase';
import { spacing, type } from '@/theme';
export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined while loading; null once we know no member has this id.
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setError('');
    loadProfile(id).then((next) => { if (active) setProfile(next); }).catch((error) => { if (active) setError(message(error)); });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Changing attempt intentionally reruns the focused request after Retry.
  }, [id, attempt]));
  if (profile === null) return <Screen edges={[]}><Text style={type.body}>Student not found.</Text></Screen>;
  return <Feed key={id} authorId={id} title={profile?.displayName ?? 'Profile'} edges={[]} header={<>
    <Card style={{ alignItems: 'center', gap: spacing.md }}><Avatar name={profile?.displayName || 'Student'} size={72} /><Text style={type.heading}>{profile?.displayName ?? ''}</Text>{profile && <ProfileStats profile={profile} />}</Card>
    <Banner message={error} />{!!error && <Button label="Retry profile" onPress={() => setAttempt((n) => n + 1)} />}<Text style={type.heading}>Posts</Text>
  </>} />;
}
