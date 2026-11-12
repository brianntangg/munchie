import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

// The white Munchie bar on the code and name screens, matching the header inside the app. It reaches up under the
// status bar, so it pads itself by the top inset. `onBack` adds a back arrow on the left.
export function AuthHeader({ onBack, backLabel = 'Back' }: { onBack?: () => void; backLabel?: string }) {
  const { top } = useSafeAreaInsets();
  return <View style={{ paddingTop: top, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
    <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 }}>
      {onBack ? <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        {/* A drawn chevron, so this screen needs no icon font. */}
        <View style={{ width: 12, height: 12, marginLeft: 4, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: colors.text, transform: [{ rotate: '45deg' }] }} />
      </Pressable> : <View style={{ width: 44 }} />}
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.3, color: colors.text }}>Munchie</Text>
      <View style={{ width: 44 }} />
    </View>
  </View>;
}
