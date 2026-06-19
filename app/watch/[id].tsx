import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, expiryColor } from '../../src/theme';
import { ExpiryBadge } from '../../src/components/ExpiryBadge';
import { SectionCard } from '../../src/components/SectionCard';
import { CertEventRow } from '../../src/components/CertEventRow';
import { ServerTimeline } from '../../src/components/ServerTimeline';
import { loadWatches, updateWatch } from '../../src/storage/watches';
import { getEventsForWatch } from '../../src/storage/events';
import { useWatches } from '../../src/hooks/useWatches';
import { useChecker } from '../../src/hooks/useChecker';
import { scheduleCertNotification } from '../../src/notifications';
import { fetchCertTargetHistory, type CertHistoryEntry } from '../../src/api/client';
import { haptics } from '../../src/haptics';
import type { CertWatch, CertEvent } from '../../src/types';

export default function WatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { remove, clearAlert } = useWatches();
  const { check } = useChecker();

  const [watch, setWatch] = useState<CertWatch | null>(null);
  const [events, setEvents] = useState<CertEvent[]>([]);
  const [serverHistory, setServerHistory] = useState<CertHistoryEntry[]>([]);
  const [checking, setChecking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const watches = await loadWatches();
    const w = watches.find((x) => x.id === id);
    if (!w) return;
    setWatch(w);
    const evts = await getEventsForWatch(id);
    setEvents(evts.sort((a, b) =>
      new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
    ));
    // Pull the backend's authoritative monitoring timeline (best-effort).
    if (w.serverTargetId) {
      setServerHistory(await fetchCertTargetHistory(w.serverTargetId));
    }
    if (w.hasAlert) await clearAlert(id);
  }, [id, clearAlert]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleCheckNow = async () => {
    if (!watch) return;
    haptics.light();
    setChecking(true);
    try {
      const { event } = await check(watch);
      if (event) {
        haptics.warning();
        await scheduleCertNotification(event);
      }
      await load();
    } catch (e: any) {
      haptics.error();
      Alert.alert('Check failed', e.message ?? 'Could not retrieve certificate data.');
    } finally {
      setChecking(false);
    }
  };

  const handleDelete = () => {
    if (!watch) return;
    haptics.medium();
    Alert.alert(
      'Remove watch',
      `Stop watching ${watch.domain}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await remove(watch.id);
            router.back();
          },
        },
      ],
    );
  };

  if (!watch) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accentLight} />
      </View>
    );
  }

  const expiryMs = watch.certExpiry ? new Date(watch.certExpiry).getTime() - Date.now() : null;
  const daysLeft = expiryMs !== null ? Math.ceil(expiryMs / 86_400_000) : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.accentLight}
        />
      }
    >

      {/* Hero */}
      <SectionCard style={styles.hero}>
        <View style={styles.heroTop}>
          <ExpiryBadge days={daysLeft} size="lg" />
          <View style={styles.heroMeta}>
            <Text style={styles.heroDomain}>{watch.domain}</Text>
            {watch.certIssuer && (
              <Text style={styles.heroIssuer} numberOfLines={2}>{watch.certIssuer}</Text>
            )}
            {watch.certExpiry && (
              <Text style={[styles.heroExpiry, { color: expiryColor(daysLeft) }]}>
                {daysLeft !== null && daysLeft <= 0
                  ? 'Expired'
                  : `Expires ${new Date(watch.certExpiry).toLocaleDateString()}`}
              </Text>
            )}
            {watch.lastCheckedAt && (
              <Text style={styles.heroTime}>
                Checked {formatRelative(watch.lastCheckedAt)}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, styles.primaryBtn]}
          onPress={handleCheckNow}
          disabled={checking}
          activeOpacity={0.8}
        >
          {checking ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Ionicons name="refresh-outline" size={16} color={colors.textPrimary} />
          )}
          <Text style={styles.actionBtnText}>
            {checking ? 'Checking…' : 'Check now'}
          </Text>
        </TouchableOpacity>
      </SectionCard>

      {/* Certificate details */}
      {watch.certSerial && (
        <View>
          <Text style={styles.sectionLabel}>Certificate details</Text>
          <SectionCard>
            <DetailRow label="Serial" value={watch.certSerial.slice(0, 20) + '…'} mono />
            {watch.certExpiry && (
              <DetailRow label="Expires" value={new Date(watch.certExpiry).toUTCString()} />
            )}
            {watch.certIssuer && (
              <DetailRow label="Issuer" value={watch.certIssuer} />
            )}
          </SectionCard>
        </View>
      )}

      {/* Server monitoring timeline */}
      {watch.serverTargetId && (
        <View>
          <Text style={styles.sectionLabel}>Monitoring timeline</Text>
          <ServerTimeline entries={serverHistory} />
        </View>
      )}

      {/* On-device events */}
      {events.length > 0 && (
        <View>
          <Text style={styles.sectionLabel}>
            On-device events ({events.length})
          </Text>
          <SectionCard style={{ padding: 0 }}>
            {events.map((event) => (
              <CertEventRow key={event.id} event={event} />
            ))}
          </SectionCard>
        </View>
      )}

      {/* Check interval */}
      <View>
        <Text style={styles.sectionLabel}>Check interval</Text>
        <SectionCard>
          <View style={styles.intervalRow}>
            {([1, 6, 24] as const).map((hrs) => (
              <TouchableOpacity
                key={hrs}
                style={[
                  styles.intervalBtn,
                  watch.checkIntervalHours === hrs && styles.intervalBtnActive,
                ]}
                onPress={async () => {
                  const updated = { ...watch, checkIntervalHours: hrs };
                  await updateWatch(updated);
                  setWatch(updated);
                }}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.intervalBtnText,
                  watch.checkIntervalHours === hrs && styles.intervalBtnTextActive,
                ]}>
                  {hrs === 1 ? '1h' : hrs === 6 ? '6h' : '24h'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.intervalNote}>
            Background checks run automatically at this cadence. iOS controls exact timing based
            on battery and usage patterns.
          </Text>
        </SectionCard>
      </View>

      {/* Delete */}
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
        <Ionicons name="trash-outline" size={16} color={colors.critical} />
        <Text style={styles.deleteBtnText}>Remove watch</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={[detailStyles.value, mono && detailStyles.mono]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  label: { color: colors.textMuted, fontSize: typography.xs, fontWeight: '600', flex: 1 },
  value: { color: colors.textSecondary, fontSize: typography.xs, flex: 2, textAlign: 'right' },
  mono: { fontFamily: 'monospace', fontSize: 10 },
});

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  hero: { gap: spacing.md },
  heroTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  heroMeta: { flex: 1, gap: 3 },
  heroDomain: { color: colors.textPrimary, fontSize: typography.md, fontWeight: '700' },
  heroIssuer: { color: colors.textMuted, fontSize: typography.xs, lineHeight: 16 },
  heroExpiry: { fontSize: typography.xs, fontWeight: '600' },
  heroTime: { color: colors.textMuted, fontSize: typography.xs },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
  },
  primaryBtn: { backgroundColor: colors.accent },
  actionBtnText: { color: colors.textPrimary, fontSize: typography.sm, fontWeight: '600' },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: typography.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  intervalRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  intervalBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  intervalBtnActive: { backgroundColor: colors.accentBg, borderColor: colors.accent },
  intervalBtnText: { color: colors.textSecondary, fontSize: typography.sm, fontWeight: '600' },
  intervalBtnTextActive: { color: colors.accentLight },
  intervalNote: { color: colors.textMuted, fontSize: typography.xs, lineHeight: 17 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.criticalBg,
    marginTop: spacing.lg,
  },
  deleteBtnText: { color: colors.critical, fontSize: typography.base, fontWeight: '600' },
});
