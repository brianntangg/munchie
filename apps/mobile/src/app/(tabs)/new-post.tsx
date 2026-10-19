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
import { filterDishes, loadMenuItems, type MenuItem } from '@/lib/menu';
import { canPost, postLabel, postWithRating } from '@/lib/post-with-rating';
import { Button, ErrorText, Field, styles } from '@/components/form-ui';
import { StarRating } from '@/components/StarRating';

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
  // Optional rating: pick one of the hall's dishes, then give it 1-5 stars. It is saved together with the post.
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [dish, setDish] = useState<MenuItem | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [dishError, setDishError] = useState('');
  const [dishAttempt, setDishAttempt] = useState(0);
  // True once the post is published but its rating still needs saving, so a retry never creates a second post.
  const [posted, setPosted] = useState(false);
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
  useEffect(() => {
    if (!session || !hallId) return;
    let active = true;
    loadMenuItems(hallId).then((items) => { if (active) setDishes(items); }).catch((error) => { if (active) setDishError(message(error)); });
    return () => { active = false; };
  }, [session, hallId, dishAttempt]);
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
  // A different hall has different dishes, so drop the previous hall's dish, score, and search.
  function chooseHall(id: string) {
    setHallId(id); setDishes([]); setDish(null); setScore(null); setQuery(''); setDishError('');
  }
  function reset() {
    setPhoto(null); setCaption(''); chooseHall(''); setPosted(false); postId.current = null;
  }
  async function submit() {
    if (!canPost({ posted, hasPhoto: !!photo, hallId, hasDish: !!dish, score }) || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    postId.current ??= randomUUID();
    try {
      const { ratingError } = await postWithRating({ postId: postId.current, userId, hallId, caption, base64: photo?.base64 ?? '', rating: dish && score !== null ? { menuItemId: dish.id, score } : undefined, alreadyPosted: posted });
      if (ratingError) { setPosted(true); setError(`Your meal was posted, but your rating was not saved: ${message(ratingError)} Try again, or skip the rating.`); return; }
      reset();
      router.navigate('/');
    } catch (error) { setError(`${message(error)} Your draft is still here; you can retry.`); }
    finally { submitting.current = false; setBusy(false); }
  }
  const locked = busy || posted;
  const { shown, total } = filterDishes(dishes, query);
  return <SafeAreaView style={styles.screen} edges={['top']}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text style={styles.heading}>Share your plate</Text><Text style={styles.body}>A photo, a dining hall, and a little food inspiration.</Text>
    {photo && <Image source={{ uri: photo.uri }} style={[styles.photo, { borderRadius: 16 }]} accessibilityLabel="Selected meal photo" />}
    <Button title="Take a photo" onPress={() => choosePhoto(true)} disabled={locked} secondary /><Button title={photo ? 'Choose a different photo' : 'Choose from library'} onPress={() => choosePhoto(false)} disabled={locked} secondary />
    <Text style={styles.label}>Dining hall</Text><View style={styles.row}>{halls.map((hall) => <Button key={hall.id} title={`${hallId === hall.id ? '✓ ' : ''}${hall.name}`} secondary={hallId !== hall.id} disabled={locked} onPress={() => chooseHall(hall.id)} />)}</View>
    <ErrorText>{hallError}</ErrorText>{!!hallError && <Button title="Reload dining halls" secondary onPress={() => { setHallError(''); setAttempt((value) => value + 1); }} />}
    {!!hallId && <View style={{ gap: 12 }}>
      <Text style={styles.label}>Rate a dish (optional)</Text>
      {dish ? <View style={{ gap: 12 }}>
        <Text style={styles.body}>✓ {dish.name}{dish.category ? ` · ${dish.category}` : ''}</Text>
        <StarRating value={score} onChange={setScore} disabled={busy} />
        <Text style={styles.body}>{score === null ? 'Tap a star to rate it.' : `You gave it ${score} of 5.`}</Text>
        {!posted && <Button title="Choose a different dish" secondary disabled={busy} onPress={() => { setDish(null); setScore(null); }} />}
      </View> : <View style={{ gap: 12 }}>
        <Field label="Search this hall’s dishes" placeholder="Try “chicken” or “pizza”" value={query} onChangeText={setQuery} editable={!locked} />
        <ErrorText>{dishError}</ErrorText>{!!dishError && <Button title="Reload dishes" secondary onPress={() => { setDishError(''); setDishAttempt((value) => value + 1); }} />}
        {!dishError && !dishes.length && <Text style={styles.body}>No dishes are listed for this hall yet.</Text>}
        {!dishError && !!dishes.length && !shown.length && <Text style={styles.body}>No dishes match “{query.trim()}”.</Text>}
        <View style={styles.row}>{shown.map((item) => <Button key={item.id} title={item.name} secondary disabled={locked} onPress={() => setDish(item)} />)}</View>
        {total > shown.length && <Text style={styles.body}>Showing {shown.length} of {total} dishes. Type to narrow the list.</Text>}
      </View>}
    </View>}
    <Field label="Caption (optional)" placeholder="What’s good today?" value={caption} onChangeText={setCaption} maxLength={280} multiline editable={!locked} />
    <ErrorText>{error}</ErrorText>
    <Button title={postLabel({ busy, posted, hasDish: !!dish })} onPress={submit} disabled={busy || !canPost({ posted, hasPhoto: !!photo, hallId, hasDish: !!dish, score })} />
    {posted && <Button title="Skip rating" secondary disabled={busy} onPress={() => { reset(); router.navigate('/'); }} />}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
