import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { likePost, unlikePost, type LikeSummary } from '@/lib/likes';
import { countLabel } from '@/lib/profiles';
import { message } from '@/lib/supabase';
import { colors, spacing, type } from '@/theme';

// Heart toggle with the like count. Updates right away and puts the old state back if the request fails.
// Callers key it by the loaded count and state, so refreshed counts replace the local state.
export function LikeButton({ postId, initial }: { postId: string; initial: LikeSummary }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function toggle() {
    if (busy) return;
    const previous = state;
    setState({ count: previous.count + (previous.likedByMe ? -1 : 1), likedByMe: !previous.likedByMe });
    setBusy(true); setError('');
    try {
      await (previous.likedByMe ? unlikePost(postId) : likePost(postId));
    } catch (error) {
      setState(previous); setError(message(error));
    } finally {
      setBusy(false);
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
