import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Banner, Button, Screen, TextField } from '@/components/ui';
import { DEMO_ACCOUNT, useAuth } from '@/lib/auth';
import { colors, spacing, type } from '@/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={{ marginTop: spacing.xxl, gap: spacing.xs }}>
        <Text style={{ fontSize: 40 }}>🍽️</Text>
        <Text style={type.title}>Munchie</Text>
        <Text style={type.caption}>See what Vanderbilt is eating, right now.</Text>
      </View>

      <Banner message={error} />

      <TextField
        label="Vanderbilt email"
        placeholder="you@vanderbilt.edu"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Password"
        placeholder="••••••••"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={handleSubmit}
      />

      <Button label="Log in" onPress={handleSubmit} loading={loading} />

      <Text style={[type.caption, { textAlign: 'center' }]}>
        New to Munchie?{' '}
        <Link href="/sign-up" style={{ color: colors.text, fontWeight: '600' }}>
          Create an account
        </Link>
      </Text>

      <Banner
        tone="info"
        message={`Prototype: log in with ${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password}, or create a new account.`}
      />
    </Screen>
  );
}
