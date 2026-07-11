import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import type { ServerMonitoringEvent } from '../api/client';

interface Props {
  event: ServerMonitoringEvent;
  highlighted?: boolean;
}

function severityVisual(severity: string | null): {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  bg: string;
} {
  switch (severity) {
    case 'critical':
      return { icon: 'alert-circle-outline', color: colors.critical, bg: colors.criticalBg };
    case 'warning':
      return { icon: 'warning-outline', color: colors.warning, bg: colors.warningBg };
    case 'good':
      return { icon: 'checkmark-circle-outline', color: colors.safe, bg: colors.safeBg };
    default:
      return { icon: 'information-circle-outline', color: colors.accentLight, bg: colors.accentBg };
  }
}

function formatEvidenceValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return JSON.stringify(v);
}

// Renders a single server-authored monitoring-event explanation (title/message/
// changedEvidence/severity/nextAction) exactly as the backend composed it — this
// is the mobile-monitoring-explanations-v1 contract. No locally-invented copy.
export function ServerEventCard({ event, highlighted }: Props) {
  const visual = severityVisual(event.severity);

  return (
    <View style={[styles.card, highlighted && styles.cardHighlighted]}>
      <View style={[styles.iconWrap, { backgroundColor: visual.bg }]}>
        <Ionicons name={visual.icon} size={18} color={visual.color} />
      </View>

      <View style={styles.content}>
        {event.title && <Text style={styles.title}>{event.title}</Text>}
        {event.message && <Text style={styles.message}>{event.message}</Text>}

        {event.changedEvidence.map((ev, i) => (
          <Text key={i} style={styles.evidence} numberOfLines={1}>
            {ev.label}: {formatEvidenceValue(ev.previous)} → {formatEvidenceValue(ev.current)}
          </Text>
        ))}

        {event.nextAction && (
          <Text style={styles.nextAction} numberOfLines={2}>
            Next: {event.nextAction}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  cardHighlighted: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  message: {
    color: colors.textSecondary,
    fontSize: typography.sm,
  },
  evidence: {
    color: colors.textMuted,
    fontSize: typography.xs,
  },
  nextAction: {
    color: colors.accentLight,
    fontSize: typography.xs,
    marginTop: 2,
  },
});
