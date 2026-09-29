import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

export const colors = { ink: '#25251F', muted: '#66685A', paper: '#FAF8F1', gold: '#EDC65D', line: '#DFDFD2', error: '#A02D28' };
export function Button({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (disabled || pressed) && { opacity: 0.5 }]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} /></View>;
}
export function ErrorText({ children }: PropsWithChildren) {
  return children ? <Text accessibilityRole="alert" style={styles.error}>{children}</Text> : null;
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, gap: 18, paddingBottom: 48 },
  title: { fontSize: 34, fontWeight: '800', color: colors.ink },
  heading: { fontSize: 22, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.muted },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
  field: { gap: 8 },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFF', borderRadius: 12, padding: 14, fontSize: 16, color: colors.ink },
  button: { backgroundColor: colors.gold, borderRadius: 12, padding: 15, alignItems: 'center', minHeight: 48 },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  buttonText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  error: { color: colors.error, fontSize: 14, lineHeight: 21 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFF', overflow: 'hidden', marginBottom: 18 },
  photo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.line },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
