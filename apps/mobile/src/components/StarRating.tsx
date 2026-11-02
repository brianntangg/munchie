import { Pressable, Text, View } from 'react-native';
import { MAX_SCORE } from '@/lib/ratings';
import { colors, spacing } from '@/theme';

const SCORES = Array.from({ length: MAX_SCORE }, (_, i) => i + 1);

// Read-only stars, e.g. ★★★★☆ for a 4.
export function Stars({ score }: { score: number }) {
  return <Text accessibilityLabel={`${score} of ${MAX_SCORE} stars`} style={{ color: colors.gold, fontSize: 18, letterSpacing: 2 }}>{'★'.repeat(score)}{'☆'.repeat(MAX_SCORE - score)}</Text>;
}

// Tap a star to choose 1-5; the chosen star and those before it fill in.
export function StarRating({ value, onChange, disabled = false }: { value: number | null; onChange: (score: number) => void; disabled?: boolean }) {
  return <View style={{ flexDirection: 'row', gap: spacing.sm }} accessibilityRole="radiogroup">
    {SCORES.map((n) => {
      const filled = value !== null && n <= value;
      return <Pressable key={n} accessibilityRole="radio" accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`} accessibilityState={{ selected: value === n, disabled }} disabled={disabled} onPress={() => onChange(n)} hitSlop={6}>
        <Text style={{ fontSize: 40, color: filled ? colors.gold : colors.border }}>{filled ? '★' : '☆'}</Text>
      </Pressable>;
    })}
  </View>;
}
