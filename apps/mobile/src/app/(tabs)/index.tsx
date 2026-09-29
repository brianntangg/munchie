import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostCard } from '@/components/PostCard';
import { Banner, Chip } from '@/components/ui';
import { currentMeal, findUser, MEAL_WINDOWS, posts, type Meal } from '@/data/mock';
import { colors, spacing, type } from '@/theme';

type Audience = 'everyone' | 'friends';

export default function FeedScreen() {
  const [audience, setAudience] = useState<Audience>('everyone');
  const [meal, setMeal] = useState<Meal | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const activeMeal = currentMeal();
  const visible = posts
    .filter((p) => audience === 'everyone' || findUser(p.userId)?.isFriend)
    .filter((p) => meal === 'all' || p.meal === meal)
    .sort((a, b) => a.minutesAgo - b.minutesAgo);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <FlatList
        data={visible}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            <Text style={type.title}>Feed</Text>
            <Banner
              tone="info"
              message={
                activeMeal
                  ? `${MEAL_WINDOWS[activeMeal].label} window is open — post what you're eating!`
                  : 'No meal window is open right now. Posting reopens at the next meal.'
              }
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Chip label="Everyone" selected={audience === 'everyone'} onPress={() => setAudience('everyone')} />
              <Chip label="Friends" selected={audience === 'friends'} onPress={() => setAudience('friends')} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              <Chip label="All meals" selected={meal === 'all'} onPress={() => setMeal('all')} />
              {(Object.keys(MEAL_WINDOWS) as Meal[]).map((m) => (
                <Chip key={m} label={MEAL_WINDOWS[m].label} selected={meal === m} onPress={() => setMeal(m)} />
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
            No posts yet for this filter.
          </Text>
        }
      />
    </SafeAreaView>
  );
}
