import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { Comments } from '@/components/Comments';
import { PostCard } from '@/components/PostCard';
import { Banner, Button, LoadingSpinner, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { loadLikes, type LikeSummary } from '@/lib/likes';
import { loadPost, type FeedPost } from '@/lib/posts';
import { message } from '@/lib/supabase';
import { type } from '@/theme';
export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewerId = useAuth().session?.user.id ?? null;
  const [post, setPost] = useState<FeedPost | null>(null);
  const [likes, setLikes] = useState<LikeSummary | undefined>(undefined);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    // Likes are optional here: if they fail to load, the post still shows, without the like button.
    loadLikes([id], viewerId).then((next) => { if (active) setLikes(next[id]); }).catch(() => {});
    loadPost(id).then((post) => { if (active) setPost(post); }).catch((error) => { if (active) setError(message(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Changing attempt intentionally reruns the focused request after Retry.
  }, [id, attempt, viewerId]));
  return <Screen edges={[]}><Banner message={error} />{loading ? <LoadingSpinner /> : error ? <Button label="Retry" onPress={() => setAttempt((n) => n + 1)} /> : post ? <><PostCard post={post} linked={false} likes={likes} /><Comments postId={post.id} /></> : <Text style={type.body}>Post not found.</Text>}</Screen>;
}
