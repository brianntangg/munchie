import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Banner, Button, Screen, TextField } from '@/components/ui';
import { MOCK_VERIFICATION_CODE, useAuth } from '@/lib/auth';
import { spacing, type } from '@/theme';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyScreen() {
  const { email, verify, resendCode, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function handleVerify() {
    setError(null);
    setNotice(null);
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      await verify(code);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    await resendCode();
    setNotice(`A new code was sent to ${email}.`);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <Screen>
      <View style={{ marginTop: spacing.xxl, gap: spacing.xs }}>
        <Text style={{ fontSize: 40 }}>📬</Text>
        <Text style={type.title}>Check your email</Text>
        <Text style={type.caption}>We sent a 6-digit code to {email}.</Text>
      </View>

      <Banner message={error} />
      <Banner message={notice} tone="success" />

      <TextField
        label="Verification code"
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        onSubmitEditing={handleVerify}
      />

      <Button label="Verify" onPress={handleVerify} loading={loading} />
      <Button
        label={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        variant="secondary"
        onPress={handleResend}
        disabled={cooldown > 0}
      />
      <Button label="Use a different email" variant="ghost" onPress={signOut} />

      <Banner tone="info" message={`Prototype: the code is always ${MOCK_VERIFICATION_CODE}.`} />
    </Screen>
  );
}
