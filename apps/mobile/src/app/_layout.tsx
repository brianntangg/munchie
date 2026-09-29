import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LoadingSpinner } from '@/components/ui';
import { colors } from '@/theme';

function RootNavigator() {
  const { session, loading } = useAuth();
  if (loading) return <LoadingSpinner label="Loading your session…" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}>
    <Stack.Protected guard={!session}><Stack.Screen name="(auth)" /></Stack.Protected>
    <Stack.Protected guard={!!session}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="post/[id]" options={{ headerShown: true, title: 'Post', headerBackTitle: 'Back' }} />
      <Stack.Screen name="dining/[id]" options={{ headerShown: true, title: 'Dining hall', headerBackTitle: 'Back' }} />
    </Stack.Protected>
  </Stack>;
}
export default function RootLayout() {
  return <AuthProvider><StatusBar style="dark" /><RootNavigator /></AuthProvider>;
}
