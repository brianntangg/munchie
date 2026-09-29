import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Banner, Button, Screen, TextField } from '@/components/ui';
import { useAuth, validateEmail, validatePassword } from '@/lib/auth';
import { colors, spacing, type } from '@/theme';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailError = submitted ? validateEmail(email) : null;
  const passwordError = submitted ? validatePassword(password) : null;
  const confirmError = submitted && confirm !== password ? 'Passwords do not match.' : null;

  async function handleSubmit() {
    setSubmitted(true);
    setError(null);
    if (validateEmail(email) || validatePassword(password) || confirm !== password) return;
    setLoading(true);
    try {
      await signUp(email, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={{ marginTop: spacing.xl, gap: spacing.xs }}>
        <Text style={type.title}>Create your account</Text>
        <Text style={type.caption}>Munchie is for Vanderbilt students only.</Text>
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
        error={emailError}
      />
      <TextField
        label="Password"
        placeholder="At least 8 characters"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={passwordError}
      />
      <TextField
        label="Confirm password"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        error={confirmError}
        onSubmitEditing={handleSubmit}
      />

      <Button label="Sign up" onPress={handleSubmit} loading={loading} />

      <Text style={[type.caption, { textAlign: 'center' }]}>
        Already have an account?{' '}
        <Link href="/sign-in" style={{ color: colors.text, fontWeight: '600' }}>
          Log in
        </Link>
      </Text>
    </Screen>
  );
}
