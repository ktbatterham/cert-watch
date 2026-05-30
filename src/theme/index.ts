export const colors = {
  bg: '#070b14',
  surface: '#0d1420',
  surfaceElevated: '#121a28',
  border: '#1e2d42',
  borderSubtle: '#162030',

  // Blue accent (cert/TLS theme)
  accent: '#1d4ed8',
  accentLight: '#60a5fa',
  accentBg: 'rgba(29,78,216,0.15)',

  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#475569',

  // Expiry status colours
  safe: '#22c55e',
  safeBg: 'rgba(34,197,94,0.12)',
  warning: '#f59e0b',
  warningBg: 'rgba(245,158,11,0.12)',
  danger: '#f97316',
  dangerBg: 'rgba(249,115,22,0.12)',
  critical: '#ef4444',
  criticalBg: 'rgba(239,68,68,0.12)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const typography = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
};

export function expiryColor(days: number | null): string {
  if (days === null) return colors.textMuted;
  if (days <= 0) return colors.critical;
  if (days <= 7) return colors.critical;
  if (days <= 14) return colors.danger;
  if (days <= 30) return colors.warning;
  return colors.safe;
}

export function expiryBgColor(days: number | null): string {
  if (days === null) return colors.borderSubtle;
  if (days <= 0) return colors.criticalBg;
  if (days <= 7) return colors.criticalBg;
  if (days <= 14) return colors.dangerBg;
  if (days <= 30) return colors.warningBg;
  return colors.safeBg;
}
