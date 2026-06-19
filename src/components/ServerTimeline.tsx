/**
 * Renders the backend's authoritative monitoring timeline for a cert target —
 * the events the server detected across every daily check, including the days
 * the app was closed. Complements the on-device event log (which only records
 * what this device happened to catch).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../theme';
import type { CertHistoryEntry } from '../api/client';

interface Props {
  entries: CertHistoryEntry[];
}

type EventMeta = { icon: string; color: string; label: string };

// The backend tags each check with an eventType; null means "routine, no change".
// We normalise the known server tags (and any local-style synonyms) to a display.
function metaFor(eventType: string): EventMeta {
  switch (eventType) {
    case 'cert_expiring':
    case 'expiring_soon':
      return { icon: 'time-outline', color: colors.warning, label: 'Expiring soon' };
    case 'cert_expired':
    case 'expired':
      return { icon: 'close-circle-outline', color: colors.critical, label: 'Expired' };
    case 'cert_renewed':
    case 'renewed':
      return { icon: 'checkmark-circle-outline', color: colors.safe, label: 'Renewed' };
    case 'issuer_changed':
      return { icon: 'swap-horizontal-outline', color: colors.accentLight, label: 'Issuer changed' };
    case 'unreachable':
      return { icon: 'cloud-offline-outline', color: colors.textMuted, label: 'Unreachable' };
    default:
      return { icon: 'ellipse-outline', color: colors.textMuted, label: eventType };
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function detailFor(entry: CertHistoryEntry): string {
  if (entry.eventType === 'cert_expiring' || entry.eventType === 'expiring_soon') {
    return entry.daysRemaining != null
      ? `${entry.daysRemaining} day${entry.daysRemaining === 1 ? '' : 's'} remaining`
      : '';
  }
  if (entry.eventType === 'unreachable') return 'Server could not reach the host';
  if (entry.issuer) return entry.issuer;
  return '';
}

export function ServerTimeline({ entries }: Props) {
  // Only surface checks that detected something — routine "no change" pings would
  // bury the signal. The count of all checks is shown as a footer.
  const events = entries.filter((e) => e.eventType);
  const lastCheck = entries[0]?.checkedAt;

  return (
    <SectionWrap>
      {events.length === 0 ? (
        <View style={styles.emptyRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.safe} />
          <Text style={styles.emptyText}>
            No changes detected since monitoring began. Checked daily by the server.
          </Text>
        </View>
      ) : (
        events.map((entry, i) => {
          const meta = metaFor(entry.eventType as string);
          const detail = detailFor(entry);
          return (
            <View
              key={`${entry.checkedAt}-${i}`}
              style={[styles.row, i === events.length - 1 && styles.rowLast]}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${meta.color}15` }]}>
                <Ionicons name={meta.icon as any} size={16} color={meta.color} />
              </View>
              <View style={styles.body}>
                <View style={styles.top}>
                  <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
                  <Text style={styles.time}>{formatDate(entry.checkedAt)}</Text>
                </View>
                {detail ? <Text style={styles.detail}>{detail}</Text> : null}
              </View>
            </View>
          );
        })
      )}
      {lastCheck && (
        <Text style={styles.footer}>
          {entries.length} server check{entries.length === 1 ? '' : 's'} · last {formatDate(lastCheck)}
        </Text>
      )}
    </SectionWrap>
  );
}

function SectionWrap({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowLast: { borderBottomWidth: 0 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, gap: 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    fontSize: typography.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  time: { color: colors.textMuted, fontSize: typography.xs },
  detail: { color: colors.textSecondary, fontSize: typography.xs },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  emptyText: { color: colors.textSecondary, fontSize: typography.xs, flex: 1, lineHeight: 17 },
  footer: {
    color: colors.textMuted,
    fontSize: 10,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
});
