import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './ui';
import type { FeedPost } from '@/lib/posts';
import { colors, radius, spacing, type } from '@/theme';
export function PostCard({ post, linked = true }: { post: FeedPost; linked?: boolean }) {
  const photo = post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={styles.photo} accessibilityLabel={post.caption || `Meal at ${post.dining_halls.name}`} /> : <View style={[styles.photo, { justifyContent: 'center', padding: spacing.lg }]}><Text style={type.caption}>Photo unavailable. Refresh to try again.</Text></View>;
  return <View style={styles.card}>
    <View style={styles.header}><Avatar name={post.profiles.display_name} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '600', color: colors.text }}>{post.profiles.display_name}</Text><Text style={type.caption}>{post.dining_halls.name} · {new Date(post.created_at).toLocaleString()}</Text></View></View>
    {linked ? <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild><Pressable accessibilityRole="button" accessibilityLabel="View meal">{photo}</Pressable></Link> : photo}
    <View style={styles.body}><Text style={type.heading}>{post.dining_halls.name}</Text>{post.caption ? <Text style={type.body}>{post.caption}</Text> : null}</View>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  photo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.goldSoft },
  body: { padding: spacing.md, gap: spacing.sm },
});
