import { useState } from 'react';
import { Link } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Avatar } from './ui';
import { Stars } from './StarRating';
import { LikeButton } from './LikeButton';
import type { LikeSummary } from '@/lib/likes';
import type { FeedPhoto, FeedPost } from '@/lib/posts';
import { colors, radius, spacing, type } from '@/theme';

// The post's photos side by side: swipe between them. Each photo carries its own dish and score beneath it,
// so what is shown always belongs to the photo on screen.
function Gallery({ post, linked }: { post: FeedPost; linked: boolean }) {
  const [width, setWidth] = useState(0);
  const [current, setCurrent] = useState(0);
  const count = post.photos.length;
  // Only posts with a dish on some photo get the dish row, so posts without one (including every older post) have no empty strip.
  const hasDish = post.photos.some((photo) => photo.dish);
  const photoView = (photo: FeedPhoto, index: number) => photo.imageUrl
    ? <Image source={{ uri: photo.imageUrl }} style={styles.photo} accessibilityLabel={`${post.caption || `Meal at ${post.dining_halls.name}`}${count > 1 ? `, photo ${index + 1} of ${count}` : ''}`} />
    : <View style={[styles.photo, { justifyContent: 'center', padding: spacing.lg }]}><Text style={type.caption}>Photo unavailable. Refresh to try again.</Text></View>;
  const page = (photo: FeedPhoto, index: number) => <View key={photo.id} style={width ? { width } : undefined}>
    {linked
      ? <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild><Pressable accessibilityRole="button" accessibilityLabel="View meal">{photoView(photo, index)}</Pressable></Link>
      : photoView(photo, index)}
    {hasDish && <View style={styles.dish} accessibilityLabel={photo.dish ? `Dish: ${photo.dish.name}` : undefined}>
      {photo.dish ? <><Text style={[type.body, { fontWeight: '600', flexShrink: 1 }]}>{photo.dish.name}</Text>{photo.dish.score !== null && <Stars score={photo.dish.score} />}</> : null}
    </View>}
  </View>;
  // onScroll rather than onMomentumScrollEnd: the latter never fires for mouse or trackpad scrolling in the browser.
  const track = (offset: number) => { if (width) setCurrent(Math.min(count - 1, Math.max(0, Math.round(offset / width)))); };
  return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    {count > 1
      ? <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={(event) => track(event.nativeEvent.contentOffset.x)}>{post.photos.map(page)}</ScrollView>
      : post.photos[0] ? page(post.photos[0], 0) : null}
    {count > 1 && <View style={styles.counter} accessibilityLabel={`Photo ${current + 1} of ${count}`}><Text style={styles.counterText}>{current + 1} / {count}</Text></View>}
  </View>;
}

// `likes` is undefined until the like counts load (or if they fail to), and then the like button is left out.
export function PostCard({ post, linked = true, likes }: { post: FeedPost; linked?: boolean; likes?: LikeSummary }) {
  return <View style={styles.card}>
    <Link href={{ pathname: '/profile/[id]', params: { id: post.author_id } }} asChild><Pressable style={styles.header} accessibilityRole="link" accessibilityLabel={`View ${post.profiles.display_name}'s profile`}><Avatar name={post.profiles.display_name} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '600', color: colors.text }}>{post.profiles.display_name}</Text><Text style={type.caption}>{post.dining_halls.name} · {new Date(post.created_at).toLocaleString()}</Text></View></Pressable></Link>
    <Gallery post={post} linked={linked} />
    <View style={styles.body}><Text style={type.heading}>{post.dining_halls.name}</Text>{post.caption ? <Text style={type.body}>{post.caption}</Text> : null}
      {(likes || linked) && <View style={styles.actions}>
        {likes && <LikeButton key={`${likes.count}:${likes.likedByMe}`} postId={post.id} initial={likes} />}
        {linked && <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild><Pressable hitSlop={8} accessibilityRole="link" accessibilityLabel="View comments" style={styles.commentsLink}>
          <Feather name="message-circle" size={20} color={colors.textMuted} /><Text style={type.body}>Comments</Text>
        </Pressable></Link>}
      </View>}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  photo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.goldSoft },
  body: { padding: spacing.md, gap: spacing.sm },
  // On a post with any dish, a fixed minimum height keeps every page the same height, whether or not its photo has one.
  dish: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.md, paddingBottom: 0, minHeight: 36 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingTop: spacing.xs },
  commentsLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  counter: { position: 'absolute', top: spacing.md, right: spacing.md, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  counterText: { color: colors.onPrimary, fontSize: 13, fontWeight: '600' },
});
