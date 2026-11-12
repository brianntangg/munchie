import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, Banner, Button, Card, LoadingSpinner } from './ui';
import { useAuth } from '@/lib/auth';
import { addComment, deleteComment, isValidComment, loadComments, MAX_COMMENT_LENGTH, type Comment } from '@/lib/comments';
import { countLabel } from '@/lib/profiles';
import { message } from '@/lib/supabase';
import { colors, radius, spacing, type } from '@/theme';

// A post's comments, oldest first, with a box to add one. Members see Delete only on their own comments.
export function Comments({ postId }: { postId: string }) {
  const { session } = useAuth();
  const me = session?.user.id;
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setLoadError('');
    loadComments(postId).then((next) => { if (active) setComments(next); })
      .catch((error) => { if (active) setLoadError(message(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Changing attempt intentionally reruns the focused request after Retry.
  }, [postId, attempt]));
  async function send() {
    if (!isValidComment(draft) || sending) return;
    setSending(true); setError('');
    try {
      const comment = await addComment({ postId, body: draft });
      setComments((current) => [...current, comment]);
      setDraft('');
    } catch (error) {
      setError(message(error));
    } finally {
      setSending(false);
    }
  }
  async function remove(id: string) {
    setDeleting(id); setError('');
    try {
      await deleteComment(id);
      setComments((current) => current.filter((comment) => comment.id !== id));
    } catch (error) {
      setError(message(error));
    } finally {
      setDeleting(null);
    }
  }
  const length = draft.trim().length;
  return <Card style={{ gap: spacing.md }}>
    <Text style={type.heading}>{loading || loadError ? 'Comments' : countLabel(comments.length, 'comment')}</Text>
    <Banner message={loadError || error} />
    {loading ? <LoadingSpinner label="Loading comments…" />
      : loadError ? <Button label="Retry comments" variant="secondary" onPress={() => setAttempt((n) => n + 1)} />
      : !comments.length ? <Text style={type.caption}>No comments yet. Start the conversation.</Text>
      : comments.map((comment) => <View key={comment.id} style={styles.comment}>
        <Avatar name={comment.authorName} size={28} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.caption}><Text style={styles.author}>{comment.authorName}</Text> · {new Date(comment.createdAt).toLocaleString()}</Text>
          <Text style={type.body}>{comment.body}</Text>
        </View>
        {comment.authorId === me && <Pressable onPress={() => remove(comment.id)} disabled={deleting === comment.id} hitSlop={8}
          accessibilityRole="button" accessibilityLabel="Delete your comment">
          <Text style={[styles.delete, deleting === comment.id && { opacity: 0.5 }]}>{deleting === comment.id ? 'Deleting…' : 'Delete'}</Text>
        </Pressable>}
      </View>)}
    <TextInput value={draft} onChangeText={setDraft} placeholder="Add a comment" placeholderTextColor={colors.textMuted}
      multiline maxLength={MAX_COMMENT_LENGTH} accessibilityLabel="Add a comment" style={styles.input} />
    <View style={styles.footer}>
      <Text style={[type.caption, length > MAX_COMMENT_LENGTH && { color: colors.danger }]}>{length}/{MAX_COMMENT_LENGTH}</Text>
      <Button label="Post comment" onPress={send} loading={sending} disabled={!isValidComment(draft)} style={{ minHeight: 40 }} />
    </View>
  </Card>;
}
const styles = StyleSheet.create({
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  author: { fontWeight: '600', color: colors.text },
  delete: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.text, minHeight: 64, textAlignVertical: 'top' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
