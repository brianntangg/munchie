import { createContext, useContext } from 'react';
import { SafeAreaView as BaseSafeAreaView, type Edge, type SafeAreaViewProps } from 'react-native-safe-area-context';

const ALL_EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];

// True for screens drawn under the Munchie header; the tabs layout provides it. This is the app's own context rather than
// React Navigation's HeaderShownContext, which expo-router marks deprecated and plans to remove.
export const UnderHeaderContext = createContext(false);

// The safe-area view every screen uses. Under the Munchie header the header already clears the notch, so the top inset is
// dropped; otherwise it behaves exactly like the library's SafeAreaView.
export function SafeAreaView({ edges, ...props }: SafeAreaViewProps) {
  const underHeader = useContext(UnderHeaderContext);
  if (!underHeader) return <BaseSafeAreaView edges={edges} {...props} />;
  const below = Array.isArray(edges) || !edges ? ((edges as Edge[] | undefined) ?? ALL_EDGES).filter((edge) => edge !== 'top') : { ...edges, top: 'off' as const };
  return <BaseSafeAreaView edges={below} {...props} />;
}
