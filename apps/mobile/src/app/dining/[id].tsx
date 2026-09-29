import { useLocalSearchParams } from 'expo-router';
import { Feed } from '@/components/Feed';
export default function DiningHallScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  return <Feed key={id} hallId={id} title={name || 'Recent meals'} edges={[]} />;
}
