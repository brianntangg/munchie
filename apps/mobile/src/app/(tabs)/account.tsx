import { Text, View } from 'react-native';

import { Avatar, Button, Card, Screen } from '@/components/ui';
import { users } from '@/data/mock';
import { useAuth } from '@/lib/auth';
import { spacing, type } from '@/theme';

export default function AccountScreen() {
  const { email, signOut } = useAuth();
  const name = email?.split('@')[0] ?? 'Student';
  const friendCount = users.filter((u) => u.isFriend).length;

  return (
    <Screen>
      <Text style={type.title}>My account</Text>

      <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
        <Avatar name={name} size={72} />
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <Text style={type.heading}>{name}</Text>
          <Text style={type.caption}>{email}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.xxl }}>
          <Stat label="Posts" value={0} />
          <Stat label="Friends" value={friendCount} />
          <Stat label="Ratings" value={0} />
        </View>
      </Card>

      <Card>
        <Text style={type.heading}>My posts</Text>
        <Text style={type.caption}>You haven't posted yet. Share your next meal from the Post tab.</Text>
      </Card>

      <Button label="Sign out" variant="danger" onPress={signOut} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={type.heading}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}
