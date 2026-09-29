import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Banner, Button, Chip, Screen, Stars, TextField } from '@/components/ui';
import { currentMeal, diningHalls, MEAL_WINDOWS, type Meal } from '@/data/mock';
import { colors, radius, spacing, type } from '@/theme';

export default function NewPostScreen() {
  const [hallId, setHallId] = useState<string | null>(null);
  const [meal, setMeal] = useState<Meal>(currentMeal() ?? 'lunch');
  const [dish, setDish] = useState('');
  const [caption, setCaption] = useState('');
  const [rating, setRating] = useState(0);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  function reset() {
    setHallId(null);
    setDish('');
    setCaption('');
    setRating(0);
    setHasPhoto(false);
    setError(null);
  }

  function handlePost() {
    if (!hasPhoto) return setError('Add a photo of your food.');
    if (!hallId) return setError('Pick a dining hall.');
    if (!dish.trim()) return setError('Tell us what the dish is.');
    if (!rating) return setError('Give it a rating.');
    // Prototype: nothing is saved.
    reset();
    setPosted(true);
  }

  if (posted) {
    return (
      <Screen>
        <View style={{ marginTop: spacing.xxl, alignItems: 'center', gap: spacing.md }}>
          <Text style={{ fontSize: 48 }}>🎉</Text>
          <Text style={type.title}>Posted!</Text>
          <Text style={type.caption}>(Prototype — posts aren't saved yet.)</Text>
        </View>
        <Button
          label="Back to feed"
          onPress={() => {
            setPosted(false);
            router.navigate('/');
          }}
        />
        <Button label="Post another" variant="secondary" onPress={() => setPosted(false)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={type.title}>New post</Text>
      <Banner message={error} />

      <Pressable
        onPress={() => setHasPhoto((v) => !v)}
        style={{
          height: 200,
          borderRadius: radius.lg,
          borderWidth: hasPhoto ? 0 : 2,
          borderStyle: 'dashed',
          borderColor: colors.border,
          backgroundColor: hasPhoto ? '#F6E3C8' : colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
        }}
      >
        <Text style={{ fontSize: hasPhoto ? 72 : 36 }}>{hasPhoto ? '🍝' : '📷'}</Text>
        <Text style={type.caption}>{hasPhoto ? 'Tap to remove photo' : 'Tap to take a photo (camera coming soon)'}</Text>
      </Pressable>

      <View style={{ gap: spacing.sm }}>
        <Text style={{ fontWeight: '500' }}>Dining hall</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {diningHalls.map((h) => (
            <Chip key={h.id} label={h.name} selected={hallId === h.id} onPress={() => setHallId(h.id)} />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={{ fontWeight: '500' }}>Meal</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {(Object.keys(MEAL_WINDOWS) as Meal[]).map((m) => (
            <Chip key={m} label={MEAL_WINDOWS[m].label} selected={meal === m} onPress={() => setMeal(m)} />
          ))}
        </View>
      </View>

      <TextField label="Dish" placeholder="e.g. Mongolian stir fry" value={dish} onChangeText={setDish} />
      <TextField
        label="Caption (optional)"
        placeholder="How is it?"
        value={caption}
        onChangeText={setCaption}
        multiline
      />

      <View style={{ gap: spacing.sm }}>
        <Text style={{ fontWeight: '500' }}>Rating</Text>
        <Stars value={rating} size={32} onChange={setRating} />
      </View>

      <Button label="Post" onPress={handlePost} />
    </Screen>
  );
}
