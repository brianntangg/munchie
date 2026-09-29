import { ProfileGate } from '@/components/ProfileGate';
import { useAuth } from '@/lib/auth';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { colors } from '@/theme';

const icon = (glyph: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <ProfileGate key={session.user.id} userId={session.user.id}><Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="dining" options={{ title: 'Dining', tabBarIcon: icon('🍽️') }} />
      <Tabs.Screen name="new-post" options={{ title: 'Post', tabBarIcon: icon('📸') }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: icon('👥') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('👤') }} />
    </Tabs></ProfileGate>
  );
}
