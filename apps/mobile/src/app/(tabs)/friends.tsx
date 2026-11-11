import { useCallback, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Feed } from '@/components/Feed';
import { useAuth } from '@/lib/auth';
import { loadFollowingIds } from '@/lib/follows';
import { message } from '@/lib/supabase';
import { Banner, Screen } from '@/components/ui';
import { type } from '@/theme';

export default function FriendsScreen() {
  const { session } = useAuth();
  const [followingIds, setFollowingIds] = useState<string[]>();
  const [error, setError] = useState('');
  const refreshFollowing = useCallback(async () => {
    if (!session) return [];
    const ids = await loadFollowingIds(session.user.id);
    setFollowingIds((current) => current?.length === ids.length && current.every((id, index) => id === ids[index]) ? current : ids);
    return ids;
  }, [session]);

  useFocusEffect(useCallback(() => {
    setFollowingIds(undefined);
    setError('');
    refreshFollowing().catch((nextError) => setError(message(nextError)));
  }, [refreshFollowing]));

  if (!session || followingIds === undefined) return error ? <Screen><Banner message={error} /></Screen> : <Screen><ActivityIndicator /></Screen>;
  return <Feed key={followingIds.join(',')} authorIds={followingIds} refreshFilter={refreshFollowing} title="Following" header={<>
    <Banner message={error} />
    {!followingIds.length && <Text style={type.body}>You are not following anyone yet.</Text>}
  </>} />;
}
