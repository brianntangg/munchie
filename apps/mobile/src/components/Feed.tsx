import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button, ErrorText, styles } from './form-ui';
import { PostCard } from './PostCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { message } from '../lib/supabase';
import { loadPosts, PAGE_SIZE, type FeedPost } from '../lib/posts';

export function Feed({ hallId, authorId, title = 'Feed', header, edges = ['top'] }: { hallId?: string; authorId?: string; title?: string; header?: ReactNode; edges?: ('top' | 'bottom')[] }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    const version = ++request.current;
    pending.current = true; setRefreshing(true); setLoadingMore(false); setError('');
    try {
      const next = await loadPosts(undefined, { hallId, authorId });
      if (version === request.current) { setPosts(next); setHasMore(next.length === PAGE_SIZE); }
    } catch (error) { if (version === request.current) setError(message(error)); }
    finally { if (version === request.current) { pending.current = false; setRefreshing(false); } }
  }, [hallId, authorId]);
  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { request.current++; pending.current = false; };
  }, [refresh]));
  async function more() {
    if (pending.current || !hasMore || !posts.length) return;
    const version = ++request.current;
    pending.current = true; setLoadingMore(true); setError('');
    try {
      const next = await loadPosts(posts[posts.length - 1], { hallId, authorId });
      if (version === request.current) { setPosts((current) => [...current, ...next]); setHasMore(next.length === PAGE_SIZE); }
    } catch (error) { if (version === request.current) setError(message(error)); }
    finally { if (version === request.current) { pending.current = false; setLoadingMore(false); } }
  }
  return <SafeAreaView style={styles.screen} edges={edges}><FlatList style={styles.screen} contentContainerStyle={styles.content} data={posts} keyExtractor={(post) => post.id} refreshing={refreshing} onRefresh={refresh}
    ListHeaderComponent={<View style={{ gap: 14, marginBottom: 8 }}>
      <Text style={styles.title}>{title}</Text>{header}<Text style={styles.body}>A look at what’s being served around campus.</Text>
      <Button title="Share a meal" onPress={() => router.navigate('/new-post')} />
      <Button title="Refresh feed" secondary disabled={refreshing} onPress={refresh} />
      <ErrorText>{error}</ErrorText>{!!error && <Button title="Retry feed" secondary onPress={refresh} />}
    </View>}
    ListEmptyComponent={<Text style={styles.body}>{refreshing ? 'Loading meals…' : error ? 'The feed could not be loaded.' : 'No meals yet. Be the first to share your plate.'}</Text>}
    renderItem={({ item }) => <View style={{ marginBottom: 18 }}><PostCard post={item} /></View>}
    ListFooterComponent={loadingMore ? <ActivityIndicator /> : hasMore ? <Button title="Load more meals" secondary onPress={more} /> : null}
  /></SafeAreaView>;
}
