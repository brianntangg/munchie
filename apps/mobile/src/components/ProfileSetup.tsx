import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Button, ErrorText, Field, styles } from './form-ui';
import { message, supabase } from '../lib/supabase';

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
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text style={styles.heading}>What should we call you?</Text><Text style={styles.body}>Your name appears next to your posts.</Text>
    <Field label="Display name" value={name} onChangeText={setName} maxLength={40} editable={!busy} />
    <Button title={busy ? 'Saving…' : 'Continue to the feed'} onPress={save} disabled={busy || !name.trim()} /><ErrorText>{error}</ErrorText>
    <Button title="Sign out" secondary disabled={busy} onPress={() => { supabase.auth.signOut({ scope: 'local' }).then(({ error }) => { if (error) setError(error.message); }).catch((error) => setError(message(error))); }} />
  </ScrollView>;
}
