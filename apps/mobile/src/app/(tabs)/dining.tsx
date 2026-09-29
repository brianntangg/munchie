import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, Screen, Stars } from '@/components/ui';
import { currentMeal, diningHalls, posts } from '@/data/mock';
import { colors, spacing, type } from '@/theme';

export default function DiningScreen() {
  const meal = currentMeal();

  return (
    <Screen>
      <Text style={type.title}>Dining halls</Text>
      {diningHalls.map((hall) => {
        const postCount = posts.filter((p) => p.hallId === hall.id).length;
        const status = meal ? hall.hours[meal] : 'Closed';
        const open = status !== 'Closed';
        return (
          <Link key={hall.id} href={{ pathname: '/dining/[id]', params: { id: hall.id } }} asChild>
            <Pressable>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[type.heading, { flex: 1 }]}>{hall.name}</Text>
                  <Text style={{ color: open ? colors.success : colors.textMuted, fontWeight: '600' }}>
                    {open ? 'Open' : 'Closed'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Stars value={hall.rating} />
                  <Text style={type.caption}>
                    {hall.rating.toFixed(1)} · {postCount} {postCount === 1 ? 'post' : 'posts'} today
                  </Text>
                </View>
              </Card>
            </Pressable>
          </Link>
        );
      })}
    </Screen>
  );
}
