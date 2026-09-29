import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { PostCard } from '@/components/PostCard';
import { Card, Screen, Stars } from '@/components/ui';
import { findHall, MEAL_WINDOWS, posts, type Meal } from '@/data/mock';
import { spacing, type } from '@/theme';

export default function DiningHallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hall = findHall(id);

  if (!hall) {
    return (
      <Screen edges={[]}>
        <Text style={type.body}>Dining hall not found.</Text>
      </Screen>
    );
  }

  const hallPosts = posts.filter((p) => p.hallId === hall.id);

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: hall.name }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Stars value={hall.rating} size={20} />
        <Text style={type.caption}>{hall.rating.toFixed(1)} average from students</Text>
      </View>

      <Card>
        <Text style={type.heading}>Hours</Text>
        {(Object.keys(MEAL_WINDOWS) as Meal[]).map((m) => (
          <View key={m} style={{ flexDirection: 'row' }}>
            <Text style={[type.body, { flex: 1 }]}>{MEAL_WINDOWS[m].label}</Text>
            <Text style={type.caption}>{hall.hours[m]}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={type.heading}>Today's menu</Text>
        {hall.menu.map((item) => (
          <Text key={item} style={type.body}>
            • {item}
          </Text>
        ))}
        <Text style={type.caption}>Menu integration with Vanderbilt Dining coming later.</Text>
      </Card>

      <Text style={type.heading}>Recent posts</Text>
      {hallPosts.length ? (
        hallPosts.map((p) => <PostCard key={p.id} post={p} />)
      ) : (
        <Text style={type.caption}>No posts from here yet.</Text>
      )}
    </Screen>
  );
}
