import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SignIn } from '@/components/SignIn';
import { Banner, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { isConfigured } from '@/lib/supabase';
import { colors, type } from '@/theme';
export default function SignInScreen() {
  const { error } = useAuth();
  if (!isConfigured) return <Screen><Text style={type.title}>Welcome to Munchie</Text><Text style={type.body}>Follow docs/sprint-2.md to configure local Supabase, then restart Expo.</Text></Screen>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><Banner message={error} /><SignIn /></SafeAreaView>;
}
