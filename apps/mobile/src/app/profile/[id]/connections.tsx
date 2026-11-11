import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { FollowButton } from '@/components/FollowButton';
import { Avatar, Banner, Button, Card, LoadingSpinner, Screen } from '@/components/ui';
import { loadConnections, type Connection } from '@/lib/follows';
import { message } from '@/lib/supabase';
import { colors, spacing, type } from '@/theme';

export default function ConnectionsScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const kind = tab === 'followers' ? 'followers' : 'following';
  const [connections, setConnections] = useState<Connection[]>();
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    setConnections(undefined);
    loadConnections(id, kind).then(setConnections).catch((nextError) => setError(message(nextError)));
  }, [id, kind]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (connections === undefined) return <Screen><LoadingSpinner /></Screen>;
  return <Screen scroll={false} edges={[]}>
    <FlatList
      data={connections}
      keyExtractor={(connection) => connection.id}
      contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
      ListHeaderComponent={<View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
        <Text style={type.title}>{kind === 'followers' ? 'Followers' : 'Following'}</Text>
        <Text style={type.caption}>{connections.length} {kind === 'followers' ? 'people follow this account' : 'accounts followed'}</Text>
        <Banner message={error} />{!!error && <Button label="Retry" onPress={load} />}
      </View>}
      ListEmptyComponent={<Card><Text style={type.body}>No {kind} yet.</Text></Card>}
      renderItem={({ item }) => <Card style={{ padding: spacing.md }}><Pressable onPress={() => router.push(`/profile/${item.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar name={item.displayName} /><View style={{ flex: 1 }}><Text style={[type.body, { color: colors.text, fontWeight: '600' }]}>{item.displayName}</Text><Text style={type.caption}>View profile</Text></View><FollowButton userId={item.id} />
      </Pressable></Card>}
    />
  </Screen>;
}
