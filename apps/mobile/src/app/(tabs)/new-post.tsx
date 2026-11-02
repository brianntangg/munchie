import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '@/lib/auth';
import { message, supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { publishPost } from '@/lib/posts';
import { Button, ErrorText, Field, styles } from '@/components/form-ui';

export default function Post() {
  const { session, loading } = useAuth();
  const [halls, setHalls] = useState<Tables<'dining_halls'>[]>([]);
  const [hallId, setHallId] = useState('');
  const [caption, setCaption] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hallError, setHallError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const postId = useRef<string | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    if (!session) return;
    let active = true;
    Promise.resolve(supabase.from('dining_halls').select('*').order('name')).then(({ data, error }) => {
      if (!active) return;
      if (error) setHallError(error.message);
      else { setHalls(data); if (!data.length) setHallError('No dining halls are available. Check the database setup.'); }
    }).catch((error) => { if (active) setHallError(message(error)); });
    return () => { active = false; };
  }, [session, attempt]);
  if (loading) return <ActivityIndicator />;
  if (!session) return <Redirect href="/" />;
  const userId = session.user.id;
  async function choosePhoto(camera: boolean) {
    setBusy(true); setError('');
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Allow camera access in Settings, or choose a photo from your library.');
      }
      const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const context = ImageManipulator.manipulate(asset.uri);
      if (Math.max(asset.width, asset.height) > 1440) context.resize(asset.width >= asset.height ? { width: 1440 } : { height: 1440 });
      const rendered = await context.renderAsync();
      const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
      if (!image.base64) throw new Error('Could not prepare this photo. Please choose another.');
      setPhoto({ uri: image.uri, base64: image.base64 }); postId.current = null;
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function submit() {
    if (!photo || !hallId || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    postId.current ??= randomUUID();
    try {
      await publishPost({ id: postId.current, userId, hallId, caption, base64: photo.base64 });
      setPhoto(null); setCaption(''); setHallId(''); postId.current = null;
      router.navigate('/');
    } catch (error) { setError(`${message(error)} Your draft is still here; you can retry.`); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <SafeAreaView style={styles.screen} edges={['top']}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text style={styles.heading}>Share your plate</Text><Text style={styles.body}>A photo, a dining hall, and a little food inspiration.</Text>
    {photo && <Image source={{ uri: photo.uri }} style={[styles.photo, { borderRadius: 16 }]} accessibilityLabel="Selected meal photo" />}
    <Button title="Take a photo" onPress={() => choosePhoto(true)} disabled={busy} secondary /><Button title={photo ? 'Choose a different photo' : 'Choose from library'} onPress={() => choosePhoto(false)} disabled={busy} secondary />
    <Text style={styles.label}>Dining hall</Text><View style={styles.row}>{halls.map((hall) => <Button key={hall.id} title={`${hallId === hall.id ? '✓ ' : ''}${hall.name}`} secondary={hallId !== hall.id} disabled={busy} onPress={() => setHallId(hall.id)} />)}</View>
    <ErrorText>{hallError}</ErrorText>{!!hallError && <Button title="Reload dining halls" secondary onPress={() => { setHallError(''); setAttempt((value) => value + 1); }} />}
    <Field label="Caption (optional)" placeholder="What’s good today?" value={caption} onChangeText={setCaption} maxLength={280} multiline editable={!busy} />
    <ErrorText>{error}</ErrorText><Button title={busy ? 'Please wait…' : 'Post meal'} onPress={submit} disabled={busy || !photo || !hallId} />
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
