import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useHeaderHeight } from './SafeArea';
import { Button, ErrorText, Field, styles } from './form-ui';
import { StarRating, Stars } from './StarRating';
import { starterDishes, suggestDishes, type MenuItem } from '@/lib/menu';
import { MAX_DISH_TEXT } from '@/lib/posts';
import { colors, radius, spacing, type } from '@/theme';

// One photo of a post being written. It is labeled with a menu dish or with free text, never both, and either can be rated.
export type PhotoDraft = { id: string; uri: string; base64: string; dish: MenuItem | null; text: string; score: number | null };

// What the photo is called, whichever way it was labeled; null while it has no label yet.
export const photoLabel = (photo: PhotoDraft): string | null => photo.dish?.name ?? (photo.text.trim() || null);

type Change = Partial<Pick<PhotoDraft, 'dish' | 'text' | 'score'>>;

// The post form's overview of its photos: each with its label and rating. Tap one to edit it.
export function PhotoSummary({ photos, onOpen }: { photos: PhotoDraft[]; onOpen: (id: string) => void }) {
  return <View style={{ gap: spacing.sm }}>
    {photos.map((photo, index) => {
      const label = photoLabel(photo);
      return <Pressable key={photo.id} onPress={() => onOpen(photo.id)} accessibilityRole="button" accessibilityLabel={`Photo ${index + 1}: ${label ?? 'not labeled yet'}. Edit`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface }}>
        <Image source={{ uri: photo.uri }} style={{ width: 64, height: 64, borderRadius: radius.md }} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>{label ?? 'What is this?'}</Text>
          {label && photo.score !== null ? <Stars score={photo.score} /> : <Text style={type.caption}>{label ? (photo.dish ? 'On the menu · not rated' : 'Your own label · not rated') : 'Tap to add a dish'}</Text>}
        </View>
        <Text style={type.caption}>Edit</Text>
      </Pressable>;
    })}
  </View>;
}

type Props = {
  photos: PhotoDraft[];
  activeId: string;
  hallName: string;
  // The hall's dishes; those already chosen for another photo are left out of the suggestions.
  dishes: MenuItem[];
  // The hall's most-rated dishes, offered before anything is typed.
  popular: MenuItem[];
  dishError: string;
  // The hall's menu is still loading, so an empty list does not yet mean the dish is not on it.
  dishesLoading: boolean;
  // The form's last error, such as a photo from "+" that could not be added, so it is visible on this screen too.
  error: string;
  maxPhotos: number;
  busy: boolean;
  // Once the post is published only menu-dish ratings can still change; a typed label's score was saved with the post.
  locked: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, change: Change) => void;
  onRemove: (id: string) => void;
  onAddMore: () => void;
  onReloadDishes: () => void;
  onDone: () => void;
};

// Full-screen step after choosing photos: shows them all, and asks what each one is. Typing searches the hall's menu;
// picking a match or keeping what they typed both let the member rate it.
export function PhotoDetails({ photos, activeId, hallName, dishes, popular, dishError, dishesLoading, error, maxPhotos, busy, locked, onSelect, onChange, onRemove, onAddMore, onReloadDishes, onDone }: Props) {
  const headerHeight = useHeaderHeight();
  const index = Math.max(0, photos.findIndex((photo) => photo.id === activeId));
  const photo = photos[index];
  if (!photo) return null;
  const last = index === photos.length - 1;
  const available = dishes.filter((item) => !photos.some((other) => other.id !== photo.id && other.dish?.id === item.id));
  const typed = photo.text.trim();
  // Typing searches the whole menu; before that, the popular dishes are offered so the common case is one tap.
  const searched = suggestDishes(available, photo.text);
  const starters = starterDishes(popular, available);
  const shown = typed ? searched.shown : starters.shown;
  const total = typed ? searched.total : 0;
  return <SafeAreaView style={styles.screen} edges={['top']}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
      <Text style={styles.heading}>What did you eat?</Text>
      <Text style={type.caption}>{photos.length > 1 ? `Photo ${index + 1} of ${photos.length}` : hallName}</Text>
    </View>
    <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.goldSoft }} accessibilityLabel={`Photo ${index + 1} of ${photos.length}`} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {photos.map((item, i) => <Pressable key={item.id} onPress={() => onSelect(item.id)} accessibilityRole="button" accessibilityState={{ selected: item.id === photo.id }} accessibilityLabel={`Photo ${i + 1}${photoLabel(item) ? `: ${photoLabel(item)}` : ''}`}>
        <Image source={{ uri: item.uri }} style={{ width: 64, height: 64, borderRadius: radius.md, borderWidth: 3, borderColor: item.id === photo.id ? colors.gold : colors.border }} />
        {photoLabel(item) ? <View style={{ position: 'absolute', right: 4, bottom: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.onPrimary, fontSize: 11, fontWeight: '700' }}>✓</Text></View> : null}
      </Pressable>)}
      {!locked && photos.length < maxPhotos && <Pressable onPress={onAddMore} disabled={busy} accessibilityRole="button" accessibilityLabel="Add another photo" style={{ width: 64, height: 64, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.textMuted }}>+</Text></Pressable>}
    </ScrollView>
    <ErrorText>{error}</ErrorText>

    {photo.dish ? <View style={{ gap: spacing.md }}>
      <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.successSoft, gap: spacing.xs }}>
        <Text style={[type.body, { fontWeight: '700' }]}>✓ {photo.dish.name}</Text>
        <Text style={type.caption}>{photo.dish.category ? `${photo.dish.category} · ` : ''}On the {hallName} menu</Text>
      </View>
      {!locked && <Button title="Change" secondary disabled={busy} onPress={() => onChange(photo.id, { dish: null, text: '', score: null })} />}
    </View> : locked ? <Text style={styles.body}>{typed || 'No label'}</Text> : <View style={{ gap: spacing.md }}>
      <Field label="Which dish is this?" placeholder={`Search the ${hallName} menu`} value={photo.text} maxLength={MAX_DISH_TEXT} autoFocus={!typed}
        onChangeText={(text) => onChange(photo.id, { text })} editable={!busy} returnKeyType="done" />
      <ErrorText>{dishError}</ErrorText>{!!dishError && <Button title="Reload dishes" secondary onPress={onReloadDishes} />}
      {!!shown.length && <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <Text style={[type.caption, { padding: spacing.md, paddingBottom: spacing.xs }]}>{typed ? `From the ${hallName} menu` : starters.popular ? `Popular at ${hallName}` : `On the ${hallName} menu`}</Text>
        {shown.map((item) => <Pressable key={item.id} onPress={() => onChange(photo.id, { dish: item, text: '' })} disabled={busy} accessibilityRole="button" accessibilityLabel={`Choose ${item.name}`}
          style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={[type.body, { fontWeight: '600' }]}>{item.name}</Text>
          {item.category ? <Text style={type.caption}>{item.category}</Text> : null}
        </Pressable>)}
        {total > shown.length && <Text style={[type.caption, { padding: spacing.md }]}>{total - shown.length} more {total - shown.length === 1 ? 'dish matches' : 'dishes match'}. Keep typing to narrow it down.</Text>}
      </View>}
      {!typed && <Text style={styles.body}>{shown.length ? 'Tap a dish to rate it, or start typing.' : dishesLoading ? `Loading the ${hallName} menu…` : `Type to search the ${hallName} menu.`} Not on the menu? Type your own name for it.</Text>}
      {!!typed && <Text style={styles.body}>{shown.length ? 'Not on the list? ' : dishesLoading ? `Still loading the ${hallName} menu. If it is not there, ` : `Nothing on the ${hallName} menu matches. Check the spelling, or keep it: `}We’ll label this photo “{typed}”.</Text>}
    </View>}

    {photo.dish || (typed && !locked) ? <View style={{ gap: spacing.md }}>
      <Text style={styles.label}>Rate this dish (optional)</Text>
      <StarRating value={photo.score} onChange={(score) => onChange(photo.id, { score })} disabled={busy} />
      <Text style={styles.body}>{photo.score === null ? 'Tap a star to rate it, or leave it unrated.' : `You gave it ${photo.score} of 5.${locked ? ' A saved rating can be changed but not removed.' : ''}`}</Text>
      {/* Once the post is published its ratings may already be saved, and a saved rating cannot be deleted, so clearing it here
          would only hide stars that stay on the post. */}
      {photo.score !== null && !locked && <Button title="Clear rating" secondary disabled={busy} onPress={() => onChange(photo.id, { score: null })} />}
    </View> : !!typed && photo.score !== null && <Stars score={photo.score} />}

    <Button title={last ? 'Done' : 'Next photo'} disabled={busy} onPress={() => (last ? onDone() : onSelect(photos[index + 1].id))} />
    {!last && <Button title="Done" secondary disabled={busy} onPress={onDone} />}
    {!locked && <Button title="Remove this photo" secondary disabled={busy} onPress={() => onRemove(photo.id)} />}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
