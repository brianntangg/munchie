import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, ErrorText, Field, styles } from './form-ui';
import { Avatar } from './ui';
import { AuthHeader } from './AuthHeader';
import { MealPhoto, Stars } from './MealArt';
import { message, supabase } from '../lib/supabase';
import { colors } from '@/theme';

// A sample post that shows the name as it is typed, so new members see where it appears.
function NamePreview({ name }: { name: string }) {
  const shown = name.trim();
  return <View accessible accessibilityLabel={`Preview: your posts will show ${shown || 'your name'}`} style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 10 }}>
    <View style={{ width: 250, borderRadius: 18, backgroundColor: colors.surface, overflow: 'hidden', transform: [{ rotate: '-2deg' }], boxShadow: '0px 10px 24px rgba(28, 28, 28, 0.12)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
        <Avatar name={shown || '?'} size={34} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{shown || 'Your name'}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>Rand · just now</Text>
        </View>
      </View>
      <MealPhoto dish="chicken" height={150} plate={112} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingTop: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Achiote Chicken</Text>
        <Stars score={4} />
      </View>
    </View>
  </View>;
}

export function ProfileSetup({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try {
      const { error } = await supabase.from('profiles').upsert({ id: userId, display_name: name.trim() });
      if (error) throw error;
      onSaved();
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <AuthHeader />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { gap: 20 }]}>
      <View style={{ gap: 8 }}>
        <Text style={[styles.heading, { fontSize: 26, fontWeight: '800' }]}>What should we call you?</Text>
        <Text style={styles.body}>Your name appears next to your posts.</Text>
      </View>
      <Field label="Display name" placeholder="Your name" value={name} onChangeText={setName} maxLength={40} editable={!busy} autoComplete="name" />
      <View style={{ gap: 10 }}>
        <Text style={[styles.body, { fontSize: 13, lineHeight: 18 }]}>How it looks on your posts</Text>
        <NamePreview name={name} />
      </View>
      <Button title={busy ? 'Saving…' : 'Continue to the feed'} onPress={save} disabled={busy || !name.trim()} /><ErrorText>{error}</ErrorText>
      <Button title="Sign out" secondary disabled={busy} onPress={() => { supabase.auth.signOut({ scope: 'local' }).then(({ error }) => { if (error) setError(error.message); }).catch((error) => setError(message(error))); }} />
    </ScrollView>
  </KeyboardAvoidingView>;
}
