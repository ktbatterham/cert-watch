import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../theme';
import type { CertEvent, CertEventType } from '../types';

interface Props {
  event: CertEvent;
}

const EVENT_META: Record<CertEventType, { icon: string; color: string; label: string }> = {
  expiring_soon: { icon: 'time-outline', color: colors.warning, label: 'Expiring soon' },
  expired: { icon: 'close-circle-outline', color: colors.critical, label: 'Expired' },
  renewed: { icon: 'checkmark-circle-outline', color: colors.safe, label: 'Renewed' },
  issuer_changed: { icon: 'swap-horizontal-outline', color: colors.accentLight, label: 'Issuer changed' },
  unreachable: { icon: 'cloud-offline-outline', color: colors.textMuted, label: 'Unreachable' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

export function CertEventRow({ event }: Props) {
  const meta = EVENT_META[event.eventType];

  let detail = '';
  if (event.eventType === 'expiring_soon' && event.daysUntilExpiry !== null) {
    detail = `${event.daysUntilExpiry} day${event.daysUntilExpiry === 1 ? '' : 's'} remaining`;
  } else if (event.eventType === 'renewed' && event.newIssuer) {
    detail = event.newIssuer;
  } else if (event.eventType === 'issuer_changed') {
    detail = `${event.oldIssuer ?? '?'} → ${event.newIssuer ?? '?'}`;
  } else if (event.eventType === 'expired') {
    detail = 'Certificate has lapsed';
  }

  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: `${meta.color}15` }]}>
        <Ionicons name={meta.icon as any} size={18} color={meta.color} />
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.domain}>{event.domain}</Text>
          <Text style={styles.time}>{formatDate(event.detectedAt)}</Text>
        </View>
        <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  domain: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  time: {
    color: colors.textMuted,
    fontSize: typography.xs,
  },
  label: {
    fontSize: typography.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detail: {
    color: colors.textSecondary,
    fontSize: typography.xs,
  },
});
