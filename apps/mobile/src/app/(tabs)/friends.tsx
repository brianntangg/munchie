import { Text } from 'react-native';
import { Card, Screen } from '@/components/ui';
import { type } from '@/theme';
export default function FriendsScreen() {
  return <Screen><Text style={type.title}>Friends</Text><Card><Text style={type.heading}>Coming soon</Text><Text style={type.body}>Following friends will be available in a future sprint. For now, explore everyone’s meals in the Feed tab.</Text></Card></Screen>;
}
