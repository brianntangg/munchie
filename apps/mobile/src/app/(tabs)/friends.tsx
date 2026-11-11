import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
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

  useEffect(() => {
    if (!session) return;
    loadFollowingIds(session.user.id).then(setFollowingIds).catch((nextError) => setError(message(nextError)));
  }, [session]);

  if (!session || followingIds === undefined) return error ? <Screen><Banner message={error} /></Screen> : <Screen><ActivityIndicator /></Screen>;
  return <Feed key={followingIds.join(',')} authorIds={followingIds} title="Following" header={<>
    <Banner message={error} />
    {!followingIds.length && <Text style={type.body}>You are not following anyone yet.</Text>}
  </>} />;
}
