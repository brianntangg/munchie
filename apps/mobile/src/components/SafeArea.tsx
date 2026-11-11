import { useContext } from 'react';
import { HeaderShownContext } from 'expo-router/react-navigation';
import { SafeAreaView as BaseSafeAreaView, type Edge, type SafeAreaViewProps } from 'react-native-safe-area-context';

const ALL_EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];

// The safe-area view every screen uses. Under a navigator header (such as the Munchie header on the tabs) the header
// already clears the notch, so the top inset is dropped; otherwise it behaves exactly like the library's SafeAreaView.
export function SafeAreaView({ edges, ...props }: SafeAreaViewProps) {
  const headerShown = useContext(HeaderShownContext);
  if (!headerShown) return <BaseSafeAreaView edges={edges} {...props} />;
  const below = Array.isArray(edges) || !edges ? ((edges as Edge[] | undefined) ?? ALL_EDGES).filter((edge) => edge !== 'top') : { ...edges, top: 'off' as const };
  return <BaseSafeAreaView edges={below} {...props} />;
}
