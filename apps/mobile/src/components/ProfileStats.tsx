import { Text, View } from 'react-native';
import type { Profile } from '@/lib/profiles';
import { countLabel } from '@/lib/profiles';
import { colors, spacing, type } from '@/theme';
function Stat({ value, label, accessibilityLabel }: { value: number; label: string; accessibilityLabel: string }) {
  return <View style={{ alignItems: 'center', minWidth: 72 }} accessible accessibilityLabel={accessibilityLabel}><Text style={[type.heading, { color: colors.text }]}>{value}</Text><Text style={type.caption}>{label}</Text></View>;
}
export function ProfileStats({ profile }: { profile: Profile }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg }}>
    <Stat value={profile.postCount} label={profile.postCount === 1 ? 'post' : 'posts'} accessibilityLabel={countLabel(profile.postCount, 'post')} />
    <Stat value={profile.followerCount} label={profile.followerCount === 1 ? 'follower' : 'followers'} accessibilityLabel={countLabel(profile.followerCount, 'follower')} />
    <Stat value={profile.followingCount} label="following" accessibilityLabel={`${profile.followingCount} following`} />
  </View>;
}
