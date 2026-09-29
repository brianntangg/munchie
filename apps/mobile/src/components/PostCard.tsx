import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Stars } from '@/components/ui';
import { findHall, findUser, MEAL_WINDOWS, timeAgo, type Post } from '@/data/mock';
import { colors, radius, spacing, type } from '@/theme';

export function FoodPhoto({ post, height = 220 }: { post: Post; height?: number }) {
  // Placeholder until real photo uploads exist.
  return (
    <View style={[styles.photo, { height, backgroundColor: post.tint }]}>
      <Text style={{ fontSize: height * 0.35 }}>{post.emoji}</Text>
    </View>
  );
}

export function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false);
  const author = findUser(post.userId);
  const hall = findHall(post.hallId);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar name={author?.name ?? '?'} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', color: colors.text }}>{author?.name}</Text>
          <Text style={type.caption}>
            {hall?.name} · {MEAL_WINDOWS[post.meal].label} · {timeAgo(post.minutesAgo)}
          </Text>
        </View>
      </View>

      <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
        <Pressable>
          <FoodPhoto post={post} />
        </Pressable>
      </Link>

      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={[type.heading, { flex: 1 }]}>{post.dish}</Text>
          <Stars value={post.rating} />
        </View>
        {post.caption ? <Text style={type.body}>{post.caption}</Text> : null}
        <View style={[styles.row, { gap: spacing.lg }]}>
          <Pressable onPress={() => setLiked((v) => !v)} hitSlop={8}>
            <Text style={{ color: liked ? colors.danger : colors.textMuted }}>
              {liked ? '♥' : '♡'} {post.likes + (liked ? 1 : 0)}
            </Text>
          </Pressable>
          <Link href={{ pathname: '/post/[id]', params: { id: post.id } }}>
            <Text style={{ color: colors.textMuted }}>💬 {post.comments.length}</Text>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  photo: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
});
