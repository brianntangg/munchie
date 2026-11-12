import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Avatar } from './ui';
import { colors, spacing } from '@/theme';

// The shared header on the main screens: the Munchie name in the middle, friends on the left, the member's account on the right.
export function HeaderTitle() {
  return <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800', letterSpacing: 0.5, color: colors.text }}>Munchie</Text>;
}

// White with a hairline underneath, matching the tab bar, so the corner buttons stand out from the page. It fills the
// whole header, so its height is the header's height, reported for the screens' keyboard offset.
export function HeaderBackground({ onHeight }: { onHeight?: (height: number) => void }) {
  return <View onLayout={(event) => onHeight?.(event.nativeEvent.layout.height)} style={{ flex: 1, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }} />;
}

// A 44pt tap target, so the corner buttons are easy to hit.
function HeaderButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={spacing.xs}
    style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.sm, opacity: pressed ? 0.6 : 1 })}>{children}</Pressable>;
}

export function FriendsButton() {
  return <HeaderButton label="Friends" onPress={() => router.navigate('/friends')}><Feather name="users" size={22} color={colors.text} /></HeaderButton>;
}

// Friends and Account are opened from the header, so they get a way back instead of the friends button.
export function BackButton({ onPress }: { onPress: () => void }) {
  return <HeaderButton label="Back" onPress={onPress}><Feather name="chevron-left" size={26} color={colors.text} /></HeaderButton>;
}

// The member's initials. The tabs layout loads the name once for every tab's header; "Student" until it arrives or if it
// cannot be loaded.
export function AccountButton({ name }: { name: string | null }) {
  return <HeaderButton label="My account" onPress={() => router.navigate('/account')}><Avatar name={name || 'Student'} size={34} /></HeaderButton>;
}
