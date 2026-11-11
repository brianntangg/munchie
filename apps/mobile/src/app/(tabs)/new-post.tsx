import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '@/lib/auth';
import { message, supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { loadMenuItems, loadPopularDishes, type MenuItem } from '@/lib/menu';
import { canPost, postLabel, postWithRating } from '@/lib/post-with-rating';
import { MAX_PHOTOS } from '@/lib/posts';
import { Button, ErrorText, Field, styles } from '@/components/form-ui';
import { PhotoDetails, PhotoSummary, type PhotoDraft } from '@/components/PhotoDetails';

export default function Post() {
  const { session, loading } = useAuth();
  const [halls, setHalls] = useState<Tables<'dining_halls'>[]>([]);
  const [hallId, setHallId] = useState('');
  const [caption, setCaption] = useState('');
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  // After photos are added the member goes to a full-screen step to say what each one is; `editing` is the photo shown there.
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hallError, setHallError] = useState('');
  const [attempt, setAttempt] = useState(0);
  // Each photo is labeled with one of the hall's dishes or with free text, and either kind can get 1-5 stars. Ratings are saved with the post.
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [popular, setPopular] = useState<MenuItem[]>([]);
  const [dishError, setDishError] = useState('');
  const [dishAttempt, setDishAttempt] = useState(0);
  // True once the post is published but a rating still needs saving, so a retry never creates a second post.
  const [posted, setPosted] = useState(false);
  // True once the post is published but its extra photos still need attaching. The draft is locked like `posted`,
  // because the post is already live: changing photos, hall or labels now would only make the retry fail or be ignored.
  const [photosPending, setPhotosPending] = useState(false);
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
    // Only a convenience, so a failure just means no starter suggestions; searching still works.
    loadPopularDishes(hallId).then((items) => { if (active) setPopular(items); }).catch(() => { if (active) setPopular([]); });
    return () => { active = false; };
  }, [session, hallId, dishAttempt]);
  if (loading) return <ActivityIndicator />;
  if (!session) return <Redirect href="/" />;
  const userId = session.user.id;
  async function prepare(asset: ImagePicker.ImagePickerAsset): Promise<PhotoDraft> {
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > 1440) context.resize(asset.width >= asset.height ? { width: 1440 } : { height: 1440 });
    const rendered = await context.renderAsync();
    const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
    if (!image.base64) throw new Error('Could not prepare this photo. Please choose another.');
    return { id: randomUUID(), uri: image.uri, base64: image.base64, dish: null, text: '', score: null };
  }
  async function addPhotos(camera: boolean) {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0 || !hallId) return;
    setBusy(true); setError('');
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Allow camera access in Settings, or choose a photo from your library.');
      }
      const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: room });
      if (result.canceled) return;
      // One photo that cannot be prepared must not throw away the rest of the selection.
      const added: PhotoDraft[] = [];
      let failed = 0;
      for (const asset of result.assets.slice(0, room)) {
        try { added.push(await prepare(asset)); } catch { failed += 1; }
      }
      if (added.length) {
        setPhotos((current) => [...current, ...added].slice(0, MAX_PHOTOS));
        setEditing(added[0].id);
        // The first photo is stored under the post's id, so a different set of photos needs a new post id.
        postId.current = null;
      }
      if (failed) setError(failed === 1 ? 'One photo could not be prepared. Please choose another.' : `${failed} photos could not be prepared. Please choose others.`);
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  function changePhoto(id: string, change: Partial<Pick<PhotoDraft, 'dish' | 'text' | 'score'>>) {
    setPhotos((current) => current.map((photo) => (photo.id === id ? { ...photo, ...change } : photo)));
  }
  function removePhoto(id: string) {
    const remaining = photos.filter((photo) => photo.id !== id);
    setPhotos(remaining); postId.current = null;
    // Removing the last photo leaves the photo screen; otherwise show the neighbor.
    if (!remaining.length) setEditing(null);
    else setEditing(remaining[Math.min(photos.findIndex((photo) => photo.id === id), remaining.length - 1)].id);
  }
  // A different hall has different dishes, so drop the previous hall's menu dishes and their scores. Typed labels and their scores stay.
  // Choosing the hall that is already selected changes nothing; clearing would drop the tags without reloading the menu.
  function chooseHall(id: string) {
    if (id === hallId) return;
    setHallId(id); setDishes([]); setPopular([]); setPhotos((current) => current.map((photo) => (photo.dish ? { ...photo, dish: null, score: null } : photo))); setDishError('');
  }
  function reset() {
    setPhotos([]); setEditing(null); setCaption(''); setHallId(''); setDishes([]); setPopular([]); setDishError(''); setPosted(false); setPhotosPending(false); postId.current = null;
  }
  // Menu dishes are rated in the ratings table; a typed label's score travels with its photo.
  const ratings = photos.flatMap((photo) => (photo.dish && photo.score !== null ? [{ menuItemId: photo.dish.id, score: photo.score }] : []));
  const typedLabel = (photo: PhotoDraft) => (!photo.dish && photo.text.trim()) || undefined;
  const typedScores = photos.filter((photo) => typedLabel(photo) && photo.score !== null).length;
  async function submit() {
    if (!canPost({ posted, photoCount: photos.length, hallId }) || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    postId.current ??= randomUUID();
    try {
      const { ratingError, photosError } = await postWithRating({ postId: postId.current, userId, hallId, caption, photos: photos.map((photo) => ({ id: photo.id, base64: photo.base64, menuItemId: photo.dish?.id, dishText: typedLabel(photo), dishTextScore: typedLabel(photo) && photo.score !== null ? photo.score : undefined })), ratings, alreadyPosted: posted, photosPending });
      if (photosError) {
        // The post is live and the ratings were attempted, so "Continue without the other photos" loses only those photos.
        setPosted(true); setPhotosPending(true);
        setError(`${photosError.message} ${message(photosError.attachError)} ${ratingError ? `A rating was not saved either: ${message(ratingError)}` : 'Your ratings were saved.'} Try again to attach them.`);
        return;
      }
      setPhotosPending(false);
      if (ratingError) { setPosted(true); setError(`Your meal was posted, but a rating was not saved: ${message(ratingError)} Try again, or skip the ratings.`); return; }
      reset();
      router.navigate('/');
    } catch (error) { setError(`${message(error)} Your draft is still here; you can retry.`); }
    finally { submitting.current = false; setBusy(false); }
  }
  const locked = busy || posted;
  const hallName = halls.find((hall) => hall.id === hallId)?.name ?? 'dining hall';
  if (editing && photos.length) return <PhotoDetails photos={photos} activeId={editing} hallName={hallName} dishes={dishes} popular={popular} dishError={dishError} maxPhotos={MAX_PHOTOS} busy={busy} locked={posted} error={error}
    onSelect={setEditing} onChange={changePhoto} onRemove={removePhoto} onAddMore={() => addPhotos(false)} onDone={() => setEditing(null)} onReloadDishes={() => { setDishError(''); setDishAttempt((value) => value + 1); }} />;
  const atLimit = photos.length >= MAX_PHOTOS;
  return <SafeAreaView style={styles.screen} edges={['top']}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text style={styles.heading}>Share your plate</Text><Text style={styles.body}>Pick a dining hall, add up to {MAX_PHOTOS} photos, and say what each one is.</Text>
    <Text style={styles.label}>Dining hall</Text><View style={styles.row}>{halls.map((hall) => <Button key={hall.id} title={`${hallId === hall.id ? '✓ ' : ''}${hall.name}`} secondary={hallId !== hall.id} disabled={locked} onPress={() => chooseHall(hall.id)} />)}</View>
    <ErrorText>{hallError}</ErrorText>{!!hallError && <Button title="Reload dining halls" secondary onPress={() => { setHallError(''); setAttempt((value) => value + 1); }} />}
    {!posted && <View style={{ gap: 12 }}>
      <Text style={styles.label}>Photos</Text>
      <Button title="Take a photo" onPress={() => addPhotos(true)} disabled={busy || atLimit || !hallId} secondary /><Button title={photos.length ? 'Add from library' : 'Choose from library'} onPress={() => addPhotos(false)} disabled={busy || atLimit || !hallId} secondary />
      {!hallId && <Text style={styles.body}>Choose a dining hall first, so we can match your photos to its menu.</Text>}
      {atLimit && <Text style={styles.body}>That’s the most photos a meal can have. Open one to remove it.</Text>}
    </View>}
    {!!photos.length && <PhotoSummary photos={photos} onOpen={setEditing} />}
    <Field label="Caption (optional)" placeholder="What’s good today?" value={caption} onChangeText={setCaption} maxLength={280} multiline editable={!locked} />
    <ErrorText>{error}</ErrorText>
    <Button title={postLabel({ busy, posted, photosPending, ratingCount: posted ? ratings.length : ratings.length + typedScores })} onPress={submit} disabled={busy || !canPost({ posted, photoCount: photos.length, hallId })} />
    {posted && <Button title={photosPending ? 'Continue without the other photos' : 'Skip ratings'} secondary disabled={busy} onPress={() => { reset(); router.navigate('/'); }} />}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
