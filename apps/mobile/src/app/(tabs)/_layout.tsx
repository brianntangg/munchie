import { AccountButton, BackButton, FriendsButton, HeaderBackground, HeaderTitle } from '@/components/AppHeader';
import { ProfileGate } from '@/components/ProfileGate';
import { HeaderHeightContext, UnderHeaderContext } from '@/components/SafeArea';
import { useAuth } from '@/lib/auth';
import { router, Tabs } from 'expo-router';
import { useRef, useState } from 'react';
import type { ColorValue } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { colors } from '@/theme';

// Line icons from the same set as the header, tinted by the tab bar's active and inactive colors.
const icon = (name: 'home' | 'coffee' | 'camera') =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} size={size - 2} color={color} />;
  };

// The tabs in the tab bar, and where the Friends and Account back arrow returns to for each.
const MAIN_TABS: Record<string, '/' | '/dining' | '/new-post'> = { index: '/', dining: '/dining', 'new-post': '/new-post' };

export default function TabsLayout() {
  const { session } = useAuth();
  const [headerHeight, setHeaderHeight] = useState(0);
  // The last tab-bar tab shown, so Back on Friends or Account returns to it.
  const lastTab = useRef<'/' | '/dining' | '/new-post'>('/');
  // The header avatar's name comes from ProfileGate, which already reads the profile, and which also reports the name a
  // new member just chose. Loading it here instead ran before a new member's profile existed, so the avatar showed the
  // "Student" fallback until a reload.
  const [displayName, setDisplayName] = useState<string | null>(null);
  if (!session) return null;
  return (
    // Every tab screen sits under the Munchie header, so their safe-area views skip the top inset.
    <ProfileGate key={session.user.id} userId={session.user.id} onName={setDisplayName}><UnderHeaderContext.Provider value><HeaderHeightContext.Provider value={headerHeight}><Tabs
      // Friends and Account return to the last tab-bar tab through their back arrow (lastTab). The default back behavior
      // stays, so Android's back button goes to Feed rather than through every tab visited.
      screenListeners={({ route }) => ({ focus: () => { const tab = MAIN_TABS[route.name]; if (tab) lastTab.current = tab; } })}
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
        headerTitle: () => <HeaderTitle />,
        headerLeft: () => <FriendsButton />,
        headerRight: () => <AccountButton name={displayName} />,
        headerBackground: () => <HeaderBackground onHeight={setHeaderHeight} />,
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
      <Tabs.Screen name="friends" options={{ title: 'Friends', href: null, headerLeft: () => <BackButton onPress={() => router.navigate(lastTab.current)} /> }} />
      {/* No avatar on Account itself: it would only link to the screen already open. */}
      <Tabs.Screen name="account" options={{ title: 'Account', href: null, headerLeft: () => <BackButton onPress={() => router.navigate(lastTab.current)} />, headerRight: () => null }} />
    </Tabs></HeaderHeightContext.Provider></UnderHeaderContext.Provider></ProfileGate>
  );
}
