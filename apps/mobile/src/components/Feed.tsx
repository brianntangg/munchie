import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button, ErrorText, styles } from './ui';
import { message, supabase } from '../lib/supabase';
import { loadPosts, PAGE_SIZE, type FeedPost } from '../lib/posts';

export function Feed() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const pending = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  const refresh = useCallback(async () => {
    const version = ++request.current;
    pending.current = true; setRefreshing(true); setLoadingMore(false); setError('');
    try {
      const next = await loadPosts();
      if (version === request.current) { setPosts(next); setHasMore(next.length === PAGE_SIZE); }
    } catch (error) { if (version === request.current) setError(message(error)); }
    finally { if (version === request.current) { pending.current = false; setRefreshing(false); } }
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { request.current++; pending.current = false; };
  }, [refresh]));
  async function more() {
    if (pending.current || !hasMore || !posts.length) return;
    const version = ++request.current;
    pending.current = true; setLoadingMore(true); setError('');
    try {
      const next = await loadPosts(posts[posts.length - 1]);
      if (version === request.current) { setPosts((current) => [...current, ...next]); setHasMore(next.length === PAGE_SIZE); }
    } catch (error) { if (version === request.current) setError(message(error)); }
    finally { if (version === request.current) { pending.current = false; setLoadingMore(false); } }
  }
  async function signOut() {
    setSigningOut(true);
    try { const { error } = await supabase.auth.signOut({ scope: 'local' }); if (error) throw error; }
    catch (error) { setError(message(error)); } finally { setSigningOut(false); }
  }
  return <FlatList style={styles.screen} contentContainerStyle={styles.content} data={posts} keyExtractor={(post) => post.id} refreshing={refreshing} onRefresh={refresh}
    ListHeaderComponent={<View style={{ gap: 14, marginBottom: 8 }}>
      <Text style={styles.title}>On the menu.</Text><Text style={styles.body}>A look at what’s being served around campus.</Text>
      <Button title="Share a meal" onPress={() => router.push('/post')} />
      <Button title={signingOut ? 'Signing out…' : 'Sign out'} secondary disabled={signingOut} onPress={signOut} />
      <ErrorText>{error}</ErrorText>{!!error && <Button title="Retry feed" secondary onPress={refresh} />}
    </View>}
    ListEmptyComponent={<Text style={styles.body}>{refreshing ? 'Loading meals…' : error ? 'The feed could not be loaded.' : 'No meals yet. Be the first to share your plate.'}</Text>}
    renderItem={({ item }) => <View style={styles.card}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.photo} accessibilityLabel={item.caption || `Meal at ${item.dining_halls.name}`} /> : <View style={[styles.photo, { justifyContent: 'center', padding: 16 }]}><Text>Photo unavailable. Pull to refresh.</Text></View>}
      <View style={{ padding: 16, gap: 6 }}><Text style={styles.heading}>{item.dining_halls.name}</Text><Text style={styles.label}>{item.profiles.display_name}</Text>{!!item.caption && <Text style={styles.body}>{item.caption}</Text>}<Text style={styles.body}>{new Date(item.created_at).toLocaleString()}</Text></View>
    </View>}
    ListFooterComponent={loadingMore ? <ActivityIndicator /> : hasMore ? <Button title="Load more meals" secondary onPress={more} /> : null}
  />;
}
