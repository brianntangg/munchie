import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorText, Field, styles } from './form-ui';
import { Button as TextButton } from './ui';
import { AuthHeader } from './AuthHeader';
import { CodeInput } from './CodeInput';
import { MealCollage, MealFan } from './MealArt';
import { codeOf, emptyCode, isComplete } from '../lib/code-input';
import { message, supabase } from '../lib/supabase';
import { colors } from '@/theme';

// `notice` is shown above the form, for example a session error from the auth provider.
export function SignIn({ notice }: { notice?: ReactNode }) {
  const { top } = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [digits, setDigits] = useState(emptyCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function sendCode() {
    const normalized = (sentTo || email).trim().toLowerCase();
    if (!/^[^@\s]+@vanderbilt\.edu$/.test(normalized)) { setError('Use your @vanderbilt.edu email address.'); return; }
    setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: normalized });
      if (error) throw error;
      setSentTo(normalized); setDigits(emptyCode());
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.verifyOtp({ email: sentTo, token: codeOf(digits), type: 'email' });
      if (error) throw error;
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  const changeEmail = () => { setSentTo(''); setError(''); };

  if (sentTo) return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <AuthHeader onBack={busy ? undefined : changeEmail} backLabel="Use a different email" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { gap: 20 }]}>
      {notice}
      <MealFan />
      <View style={{ gap: 8 }}>
        <Text style={[styles.heading, { fontSize: 26, fontWeight: '800' }]}>Check your email</Text>
        <Text style={styles.body}>Enter the code sent to <Text style={{ color: colors.text, fontWeight: '600' }}>{sentTo}</Text>.</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Verification code</Text>
        <CodeInput digits={digits} onChange={setDigits} editable={!busy} />
      </View>
      <View style={{ gap: 10 }}>
        <Button title={busy ? 'Please wait…' : 'Verify and sign in'} onPress={verify} disabled={busy || !isComplete(digits)} />
        <Button title="Resend code" onPress={sendCode} disabled={busy} secondary />
        <TextButton label="Use a different email" variant="ghost" onPress={changeEmail} disabled={busy} />
      </View>
      <ErrorText>{error}</ErrorText>
    </ScrollView>
  </KeyboardAvoidingView>;

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: top, paddingBottom: 48 }}>
      <MealCollage />
      <View style={[styles.content, { marginTop: -6, paddingTop: 0 }]}>
        {notice}
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ fontSize: 44, fontWeight: '800', letterSpacing: -0.5, color: colors.text }}>Munchie</Text>
          <Text style={{ fontSize: 18, fontWeight: '600', lineHeight: 24, color: colors.textMuted }}>What’s good on campus?</Text>
        </View>
        <Field label="Vanderbilt email" placeholder="you@vanderbilt.edu" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} onSubmitEditing={sendCode} returnKeyType="send" />
        <Button title={busy ? 'Sending…' : 'Send sign-in code'} onPress={sendCode} disabled={busy} />
        <Text style={[styles.body, { fontSize: 14, textAlign: 'center' }]}>New here? Your first sign-in creates your account.</Text>
        <ErrorText>{error}</ErrorText>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
