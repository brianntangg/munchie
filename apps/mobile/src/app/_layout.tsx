import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/auth';
import { colors } from '../components/ui';

export default function Layout() {
  return <AuthProvider><StatusBar style="dark" /><Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.ink, contentStyle: { backgroundColor: colors.paper } }}>
    <Stack.Screen name="index" options={{ title: 'munchie', headerBackVisible: false }} />
    <Stack.Screen name="post" options={{ title: 'Share a meal' }} />
  </Stack></AuthProvider>;
}
