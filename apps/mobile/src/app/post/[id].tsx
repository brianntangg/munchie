import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { PostCard } from '@/components/PostCard';
import { Avatar, Button, Card, Screen, TextField } from '@/components/ui';
import { findPost, findUser, type Comment } from '@/data/mock';
import { spacing, type } from '@/theme';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = findPost(id);
  const [comments, setComments] = useState<Comment[]>(post?.comments ?? []);
  const [draft, setDraft] = useState('');

  if (!post) {
    return (
      <Screen edges={[]}>
        <Text style={type.body}>Post not found.</Text>
      </Screen>
    );
  }

  function addComment() {
    if (!draft.trim()) return;
    setComments((prev) => [...prev, { id: String(Date.now()), userId: 'me', text: draft.trim() }]);
    setDraft('');
  }

  return (
    <Screen edges={[]}>
      <PostCard post={post} />

      <Text style={type.heading}>Comments</Text>
      {comments.length === 0 ? <Text style={type.caption}>No comments yet.</Text> : null}
      {comments.map((c) => {
        const author = findUser(c.userId);
        return (
          <Card key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar name={author?.name ?? '?'} size={28} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{author?.name}</Text>
              <Text style={type.body}>{c.text}</Text>
            </View>
          </Card>
        );
      })}

      <TextField label="Add a comment" placeholder="Say something…" value={draft} onChangeText={setDraft} />
      <Button label="Comment" onPress={addComment} disabled={!draft.trim()} />
    </Screen>
  );
}
