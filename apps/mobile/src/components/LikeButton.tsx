import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { likePost, toggledLike, unlikePost, type LikeSummary } from '@/lib/likes';
import { countLabel } from '@/lib/profiles';
import { message } from '@/lib/supabase';
import { colors, spacing, type } from '@/theme';

// Posts whose like or unlike is still saving. Kept outside the component, because refreshed counts remount the button
// (see below) and would otherwise let a quick second tap send a second request.
const saving = new Set<string>();

// Heart toggle with the like count. Updates right away and puts the old state back if the request fails.
// Callers key it by the loaded count and state, so refreshed counts replace the local state.
export function LikeButton({ postId, initial }: { postId: string; initial: LikeSummary }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function toggle() {
    if (busy || saving.has(postId)) return;
    const previous = state;
    setState(toggledLike(previous));
    saving.add(postId); setBusy(true); setError('');
    try {
      await (previous.likedByMe ? unlikePost(postId) : likePost(postId));
    } catch (error) {
      setState(previous); setError(message(error));
    } finally {
      saving.delete(postId); setBusy(false);
    }
  }
  return <View style={styles.wrap}>
    <Pressable onPress={toggle} hitSlop={8} accessibilityRole="button" accessibilityState={{ selected: state.likedByMe, busy }}
      accessibilityLabel={`${state.likedByMe ? 'Unlike' : 'Like'} this meal, ${countLabel(state.count, 'like')}`} style={styles.button}>
      <Ionicons name={state.likedByMe ? 'heart' : 'heart-outline'} size={22} color={state.likedByMe ? colors.danger : colors.textMuted} />
      <Text style={type.body}>{countLabel(state.count, 'like')}</Text>
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  button: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  error: { color: colors.danger, fontSize: 13 },
});
