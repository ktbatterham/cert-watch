import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { expiryColor, expiryBgColor, typography, radius, spacing } from '../theme';

interface Props {
  days: number | null;
  size?: 'sm' | 'lg';
}

export function ExpiryBadge({ days, size = 'sm' }: Props) {
  const color = expiryColor(days);
  const bg = expiryBgColor(days);

  const label =
    days === null ? '?' :
    days <= 0 ? 'Expired' :
    days === 1 ? '1 day' :
    days < 365 ? `${days}d` :
    `${Math.floor(days / 365)}y`;

  if (size === 'lg') {
    return (
      <View style={[styles.lgBadge, { backgroundColor: bg, borderColor: `${color}40` }]}>
        <Text style={[styles.lgText, { color }]}>{label}</Text>
        {days !== null && days > 0 && (
          <Text style={[styles.lgSub, { color }]}>left</Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.smBadge, { backgroundColor: bg, borderColor: `${color}40` }]}>
      <Text style={[styles.smText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  smBadge: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  smText: {
    fontSize: typography.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  lgBadge: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lgText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  lgSub: {
    fontSize: typography.xs,
    fontWeight: '600',
    opacity: 0.8,
  },
});
