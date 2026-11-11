import { useEffect, useState } from 'react';
import { Banner, Button } from './ui';
import { useAuth } from '@/lib/auth';
import { followUser, isFollowing, unfollowUser } from '@/lib/follows';
import { message } from '@/lib/supabase';

export function FollowButton({ userId, onChanged }: { userId: string; onChanged?: () => void }) {
  const { session } = useAuth();
  const currentUserId = session?.user.id;
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUserId || currentUserId === userId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    isFollowing(currentUserId, userId)
      .then((next) => { if (active) setFollowing(next); })
      .catch((nextError) => { if (active) setError(message(nextError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUserId, userId]);

  if (!currentUserId || currentUserId === userId) return null;

  async function toggleFollow() {
    setBusy(true);
    setError('');
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
      } else {
        await followUser(userId);
        setFollowing(true);
      }
      onChanged?.();
    } catch (nextError) {
      setError(message(nextError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        label={following ? 'Following' : 'Follow'}
        variant={following ? 'secondary' : 'primary'}
        loading={loading || busy}
        onPress={toggleFollow}
      />
      <Banner message={error} />
    </>
  );
}
