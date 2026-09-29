import { useState } from 'react';
import { Text, View } from 'react-native';

import { Avatar, Button, Card, Screen, TextField } from '@/components/ui';
import { users } from '@/data/mock';
import { spacing, type } from '@/theme';

export default function FriendsScreen() {
  const [query, setQuery] = useState('');
  const [following, setFollowing] = useState(() => new Set(users.filter((u) => u.isFriend).map((u) => u.id)));

  const q = query.trim().toLowerCase();
  const matches = users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.handle.includes(q));
  const friends = matches.filter((u) => following.has(u.id));
  const suggestions = matches.filter((u) => !following.has(u.id));

  function toggle(id: string) {
    setFollowing((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const renderUser = (u: (typeof users)[number]) => (
    <Card key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Avatar name={u.name} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600' }}>{u.name}</Text>
        <Text style={type.caption}>@{u.handle}</Text>
      </View>
      <Button
        label={following.has(u.id) ? 'Following' : 'Follow'}
        variant={following.has(u.id) ? 'secondary' : 'primary'}
        onPress={() => toggle(u.id)}
        style={{ minHeight: 36 }}
      />
    </Card>
  );

  return (
    <Screen>
      <Text style={type.title}>Friends</Text>
      <TextField label="Search" placeholder="Name or @handle" autoCapitalize="none" value={query} onChangeText={setQuery} />

      <Text style={type.heading}>Following ({friends.length})</Text>
      {friends.length ? friends.map(renderUser) : <Text style={type.caption}>No one yet.</Text>}

      <Text style={type.heading}>Suggested</Text>
      {suggestions.length ? suggestions.map(renderUser) : <Text style={type.caption}>No suggestions.</Text>}
    </Screen>
  );
}
