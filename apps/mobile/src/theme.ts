export const colors = {
  background: '#FAF8F4',
  surface: '#FFFFFF',
  text: '#1C1C1C',
  textMuted: '#6B6B6B',
  border: '#E6E1D6',
  primary: '#1C1C1C',
  onPrimary: '#FFFFFF',
  gold: '#CFAE70',
  goldSoft: '#F4ECDB',
  danger: '#B3261E',
  dangerSoft: '#FCE8E6',
  success: '#1E7B34',
  successSoft: '#E4F4E8',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { md: 12, lg: 16 };

export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  caption: { fontSize: 13, color: colors.textMuted },
};
