import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { Button, ErrorText, Field, styles } from './form-ui';
import { message, supabase } from '../lib/supabase';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function sendCode() {
    const normalized = email.trim().toLowerCase();
    if (!/^[^@\s]+@vanderbilt\.edu$/.test(normalized)) { setError('Use your @vanderbilt.edu email address.'); return; }
    setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: normalized });
      if (error) throw error;
      setSentTo(normalized); setCode('');
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.verifyOtp({ email: sentTo, token: code.trim(), type: 'email' });
      if (error) throw error;
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text style={styles.title}>What’s good on campus?</Text>
    <Text style={styles.body}>See what Vanderbilt is eating. Share your plate and find your next meal.</Text>
    {sentTo ? <>
      <Text style={styles.heading}>Check your email</Text>
      <Text style={styles.body}>Enter the code sent to {sentTo}.</Text>
      <Field label="Verification code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={10} editable={!busy} />
      <Button title={busy ? 'Please wait…' : 'Verify and sign in'} onPress={verify} disabled={busy || code.trim().length < 6} />
      <Button title="Resend code" onPress={sendCode} disabled={busy} secondary />
      <Button title="Use a different email" onPress={() => { setSentTo(''); setError(''); }} disabled={busy} secondary />
    </> : <>
      <Field label="Vanderbilt email" placeholder="you@vanderbilt.edu" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} />
      <Button title={busy ? 'Sending…' : 'Send sign-in code'} onPress={sendCode} disabled={busy} />
      <Text style={styles.body}>New here? Your first sign-in creates your account.</Text>
    </>}
    <ErrorText>{error}</ErrorText>
  </ScrollView></KeyboardAvoidingView>;
}
