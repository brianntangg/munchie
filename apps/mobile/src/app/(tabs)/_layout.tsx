import { AccountButton, BackButton, FriendsButton, HeaderBackground, HeaderTitle } from '@/components/AppHeader';
import { ProfileGate } from '@/components/ProfileGate';
import { UnderHeaderContext } from '@/components/SafeArea';
import { useAuth } from '@/lib/auth';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { colors } from '@/theme';

// Line icons from the same set as the header, tinted by the tab bar's active and inactive colors.
const icon = (name: 'home' | 'coffee' | 'camera') =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} size={size - 2} color={color} />;
  };

export default function TabsLayout() {
  const { session } = useAuth();
  if (!session) return null;
  return (
    // Every tab screen sits under the Munchie header, so their safe-area views skip the top inset.
    <ProfileGate key={session.user.id} userId={session.user.id}><UnderHeaderContext.Provider value><Tabs
      // Friends and Account are opened from the header, so Back returns to whichever tab opened them.
      backBehavior="history"
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
        headerTitle: () => <HeaderTitle />,
        headerLeft: () => <FriendsButton />,
        headerRight: () => <AccountButton userId={session.user.id} />,
        headerBackground: () => <HeaderBackground />,
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="dining" options={{ title: 'Dining', tabBarIcon: icon('coffee') }} />
      <Tabs.Screen name="new-post" options={{ title: 'Post', tabBarIcon: icon('camera') }} />
      {/* Opened from the header's corners rather than the tab bar. */}
      <Tabs.Screen name="friends" options={{ title: 'Friends', href: null, headerLeft: () => <BackButton /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', href: null, headerLeft: () => <BackButton /> }} />
    </Tabs></UnderHeaderContext.Provider></ProfileGate>
  );
}
