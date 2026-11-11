import { Text, View, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';

// Drawn meals for the sign-in screens: a plate with a simple dish on a colored table. Plain views, so they look the
// same on web and phones and need no image files.
export type Dish = 'chicken' | 'lasagna' | 'burger' | 'brownies';

const TABLE: Record<Dish, string> = { chicken: '#B5835A', lasagna: '#3F5B4A', burger: '#2E2A27', brownies: '#E3D2BA' };
const SHADOW: ViewStyle = { boxShadow: '0px 10px 24px rgba(28, 28, 28, 0.12)' };

function Food({ dish, size }: { dish: Dish; size: number }) {
  if (dish === 'chicken') return <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.02 }}>
    <View style={{ width: size * 0.4, height: size * 0.34, borderRadius: size * 0.17, backgroundColor: '#C2552A', overflow: 'hidden' }}>
      <View style={{ width: size * 0.22, height: size * 0.18, borderRadius: size * 0.1, backgroundColor: '#E58A45', margin: size * 0.04 }} />
    </View>
    <View style={{ width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15, backgroundColor: '#F1E2BC', borderWidth: 2, borderColor: '#E8D5A6' }} />
  </View>;
  if (dish === 'lasagna') return <View style={{ width: size * 0.54, height: size * 0.44, borderRadius: 6, overflow: 'hidden', transform: [{ rotate: '-8deg' }] }}>
    {['#D9572F', '#F5E4B8', '#7A9B4E', '#D9572F', '#F5E4B8', '#D9572F'].map((color, index) => <View key={index} style={{ flex: index % 3 === 0 ? 3 : 1, backgroundColor: color }} />)}
  </View>;
  if (dish === 'burger') return <View style={{ width: size * 0.58, height: size * 0.42 }}>
    <View style={{ flex: 4, backgroundColor: '#D19449', borderTopLeftRadius: size * 0.3, borderTopRightRadius: size * 0.3 }} />
    <View style={{ flex: 1, backgroundColor: '#7FA650' }} />
    <View style={{ flex: 2, backgroundColor: '#4A2E21' }} />
    <View style={{ flex: 2, backgroundColor: '#E2B36B', borderBottomLeftRadius: size * 0.1, borderBottomRightRadius: size * 0.1 }} />
  </View>;
  return <View style={{ width: size * 0.48, height: size * 0.48, flexDirection: 'row', flexWrap: 'wrap', gap: size * 0.04 }}>
    {['#5B3A29', '#4E3123', '#4E3123', '#5B3A29'].map((color, index) => <View key={index} style={{ width: size * 0.22, height: size * 0.22, borderRadius: 4, backgroundColor: color }} />)}
  </View>;
}

// A plate on its table, filling the given box.
export function MealPhoto({ dish, height, plate, style }: { dish: Dish; height: number; plate: number; style?: ViewStyle }) {
  return <View style={[{ height, backgroundColor: TABLE[dish], alignItems: 'center', justifyContent: 'center' }, style]}>
    <View style={{ width: plate, height: plate, borderRadius: plate / 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#EDE7DC', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: plate * 0.8, height: plate * 0.8, borderRadius: plate * 0.4, borderWidth: 1, borderColor: '#F1ECE3' }} />
      <Food dish={dish} size={plate} />
    </View>
  </View>;
}

export function Stars({ score, size = 13 }: { score: number; size?: number }) {
  return <Text accessibilityLabel={`${score} of 5 stars`} style={{ fontSize: size, letterSpacing: 1 }}>
    <Text style={{ color: colors.gold }}>{'★'.repeat(score)}</Text><Text style={{ color: colors.border }}>{'★'.repeat(5 - score)}</Text>
  </Text>;
}

type CardSpec = { dish: Dish; name: string; hall: string; score: number; left: number; top: number; rotate: string };
// Real dishes and halls from the seed menu. The lower two are mostly hidden by the fade, so they show no text.
const CARDS: CardSpec[] = [
  { dish: 'chicken', name: 'Achiote Chicken', hall: 'Rand', score: 4, left: 2, top: 22, rotate: '-4deg' },
  { dish: 'lasagna', name: 'Vegetable Lasagna', hall: 'Commons', score: 5, left: 188, top: 54, rotate: '4deg' },
  { dish: 'burger', name: '', hall: '', score: 0, left: 10, top: 250, rotate: '3deg' },
  { dish: 'brownies', name: '', hall: '', score: 0, left: 180, top: 282, rotate: '-3deg' },
];
// Thin strips of the page color with rising opacity: a smooth fade without a gradient library.
const FADE_STEPS = Array.from({ length: 20 }, (_, index) => Math.min(1, ((index + 1) / 20) ** 1.4 * 1.05));

// The sign-in screen's pinboard of tilted meal cards, fading into the page at the bottom. Decorative only.
export function MealCollage({ height = 326 }: { height?: number }) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height, overflow: 'hidden' }}>
    <View style={{ width: 350, height, alignSelf: 'center' }}>
      {CARDS.map((card) => <View key={card.dish} style={[{ position: 'absolute', left: card.left, top: card.top, width: 160, borderRadius: 18, backgroundColor: colors.surface, overflow: 'hidden', transform: [{ rotate: card.rotate }] }, SHADOW]}>
        <MealPhoto dish={card.dish} height={128} plate={100} />
        {!!card.name && <View style={{ padding: 12, paddingTop: 10, gap: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{card.name}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{card.hall}</Text>
          <Stars score={card.score} />
        </View>}
      </View>)}
    </View>
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      {FADE_STEPS.map((opacity, index) => <View key={index} style={{ height: 3, backgroundColor: colors.background, opacity }} />)}
    </View>
  </View>;
}

// A smaller fan of three plates for the code screen, so it looks like the same flow.
export function MealFan() {
  const tiles: { dish: Dish; left: number; top: number; rotate: string; z: number }[] = [
    { dish: 'chicken', left: 0, top: 14, rotate: '-9deg', z: 0 },
    { dish: 'brownies', left: 138, top: 14, rotate: '8deg', z: 0 },
    { dish: 'lasagna', left: 69, top: 0, rotate: '0deg', z: 1 },
  ];
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 234, height: 140, alignSelf: 'center' }}>
    {tiles.map((tile) => <View key={tile.dish} style={[{ position: 'absolute', left: tile.left, top: tile.top, zIndex: tile.z, width: 96, height: 112, borderRadius: radius.lg, borderWidth: 4, borderColor: colors.surface, overflow: 'hidden', transform: [{ rotate: tile.rotate }] }, SHADOW]}>
      <MealPhoto dish={tile.dish} height={104} plate={66} />
    </View>)}
  </View>;
}
