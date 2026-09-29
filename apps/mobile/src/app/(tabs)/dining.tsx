import { useCallback, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { Text } from 'react-native';
import { Banner, Button, Card, LoadingSpinner, Screen } from '@/components/ui';
import { message, supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { type } from '@/theme';
export default function DiningScreen() {
  const [halls, setHalls] = useState<Tables<'dining_halls'>[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.resolve(supabase.from('dining_halls').select('*').order('name')).then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message); else setHalls(data);
    }).catch((error) => { if (active) setError(message(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Changing attempt intentionally reruns the focused request after Retry.
  }, [attempt]));
  return <Screen><Text style={type.title}>Dining halls</Text><Text style={type.caption}>Explore meals shared across campus.</Text><Banner message={error} />
    {loading ? <LoadingSpinner /> : error ? <Button label="Retry" onPress={() => setAttempt((n) => n + 1)} /> : halls.length ? halls.map((hall) => <Card key={hall.id}><Text style={type.heading}>{hall.name}</Text><Link href={{ pathname: '/dining/[id]', params: { id: hall.id, name: hall.name } }}>View recent meals →</Link></Card>) : <Text style={type.body}>No dining halls available.</Text>}
  </Screen>;
}
