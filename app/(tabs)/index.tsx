import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../../src/theme';
import { ExpiryBadge } from '../../src/components/ExpiryBadge';
import { useWatches } from '../../src/hooks/useWatches';
import {
  sendTestNotification,
  fetchCertServerSummary,
  fetchMonitoringHealth,
  type CertServerSummary,
  type ServerTargetStatus,
} from '../../src/api/client';
import type { ParsedMonitoringHealth } from '../../src/api/schemas';
import { haptics } from '../../src/haptics';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { BACKGROUND_FETCH_TASK } from '../../src/tasks/background';
import { deriveAttention, attentionFromServer } from '../../src/lib/attention';
import { fetchMonitoringAttention } from '../../src/api/client';
import type { ParsedAttention } from '../../src/api/schemas';
import type { CertWatch } from '../../src/types';

export default function WatchesScreen() {
  const router = useRouter();
  const { watches, serverStatus, load } = useWatches();
  const [refreshing, setRefreshing] = useState(false);
  const [bgStatus, setBgStatus] = useState<string>('');
  const [serverSummary, setServerSummary] = useState<CertServerSummary | null>(null);
  const [monitoringHealth, setMonitoringHealth] = useState<ParsedMonitoringHealth | null>(null);
  const [testing, setTesting] = useState(false);

  // Attention-first ordering + counts. Prefer the server-authored
  // monitoring-attention-v1 rollup when the capability is live; fall back to the
  // local derivation (byte-identical to before) when the flag is absent or the
  // fetch fails. Both map to one AttentionSummary in src/lib/attention.ts.
  const [serverAttention, setServerAttention] = useState<ParsedAttention | null>(null);
  useEffect(() => {
    let alive = true;
    fetchMonitoringAttention().then((a) => {
      if (alive) setServerAttention(a);
    });
    return () => {
      alive = false;
    };
  }, [watches]);
  const attention = useMemo(
    () =>
      serverAttention
        ? attentionFromServer(serverAttention, watches)
        : deriveAttention(watches, serverStatus),
    [serverAttention, watches, serverStatus],
  );
  const attentionCount = attention.counts.attention + attention.counts.critical;

  const handleTestNotification = () => {
    Alert.alert(
      'Send test notification',
      'Send a test push to this device to confirm notifications are working?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            haptics.light();
            setTesting(true);
            const result = await sendTestNotification();
            setTesting(false);
            if (result.ok) haptics.success();
            else haptics.warning();
            Alert.alert(result.ok ? 'Sent' : 'Not sent', result.message);
          },
        },
      ],
    );
  };

  const init = useCallback(async () => {
    await load();
    // Authoritative owner-scoped status from the backend (capability-gated;
    // null on older servers / offline — the local guess below still renders).
    fetchCertServerSummary().then(setServerSummary).catch(() => {});
    // Pipeline-level confidence caption ("is server monitoring itself working").
    // Best-effort: null (offline / drift) simply renders nothing.
    fetchMonitoringHealth().then(setMonitoringHealth).catch(() => {});
    try {
      const status = await BackgroundFetch.getStatusAsync();
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
      if (status === BackgroundFetch.BackgroundFetchStatus.Available && isRegistered) {
        setBgStatus('active');
      } else if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
        setBgStatus('pending');
      } else {
        setBgStatus('unavailable');
      }
    } catch {
      // BackgroundFetch not available in Expo Go
    }
  }, [load]);

  useFocusEffect(useCallback(() => { init(); }, [init]));

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Cert Watch</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => { haptics.light(); router.push('/settings'); }}
              activeOpacity={0.8}
              accessibilityLabel="Open settings"
            >
              <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleTestNotification}
              disabled={testing}
              activeOpacity={0.8}
              accessibilityLabel="Send a test notification"
            >
              {testing ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { haptics.light(); router.push('/add'); }}
              activeOpacity={0.8}
              accessibilityLabel="Add a domain to watch"
            >
              <Ionicons name="add" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {watches.length === 0
            ? 'No domains being watched'
            : `${watches.length} domain${watches.length === 1 ? '' : 's'} watched`}
        </Text>
        {serverSummary ? (
          <Text style={styles.bgStatus}>
            {/* Attention counts render in the attention bar below (src/lib/attention.ts),
                which supersets this summary with local-expiry fallback. */}
            {serverSummary.needsAttention > 0 ? null : serverSummary.totalCerts > 0 ? (
              <Text style={styles.statusSafe}>● All certificates healthy</Text>
            ) : (
              <Text>○ Server monitoring ready</Text>
            )}
            {serverSummary.nextCheckAt
              ? `  ·  next check ${formatRelativeFuture(serverSummary.nextCheckAt)}`
              : ''}
            {serverSummary.pushConfigured
              ? serverSummary.pushReady
                ? '  ·  push ✓'
                : '  ·  push degraded'
              : '  ·  push not registered'}
          </Text>
        ) : bgStatus ? (
          <Text style={styles.bgStatus}>
            {bgStatus === 'active'
              ? '● Background checks active'
              : bgStatus === 'pending'
              ? '○ Background checks pending'
              : '○ Background checks unavailable'}
          </Text>
        ) : null}
      </View>

      {attentionCount > 0 && (
        <View style={styles.attentionBar}>
          <View
            style={[
              styles.attentionDot,
              attention.state === 'critical' && styles.attentionDotCritical,
            ]}
          />
          <Text style={styles.attentionText}>
            {attentionCount} need{attentionCount === 1 ? 's' : ''} attention
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={watches.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accentLight}
          />
        }
      >
        {watches.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="shield-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nothing watching yet</Text>
            <Text style={styles.emptyText}>
              Add a domain to start monitoring its TLS certificate expiry.
            </Text>
          </View>
        ) : (
          attention.orderedWatches.map((watch) => (
            <WatchRow
              key={watch.id}
              watch={watch}
              serverStatus={serverStatus.get(watch.id)}
              onPress={() => { haptics.light(); router.push(`/watch/${watch.id}`); }}
            />
          ))
        )}
      </ScrollView>

      {monitoringHealth && watches.length > 0 && (
        <Text style={styles.healthFooter}>{monitoringHealthCaption(monitoringHealth)}</Text>
      )}
    </View>
  );
}

// Subtle confidence caption for the server monitoring pipeline, from
// /api/monitoring-health. Degraded when the sweep scheduler is off/unhealthy or
// the push channel can't deliver; otherwise a quiet "it's working" line.
function monitoringHealthCaption(health: ParsedMonitoringHealth): string {
  const degraded =
    !health.schedulerEnabled ||
    !health.lastSweepHealthy ||
    !health.notificationsEnabled ||
    !health.notificationCredentialsConfigured;
  const base = degraded
    ? 'Monitoring degraded: checks may be delayed'
    : 'Server monitoring active · last sweep healthy';
  return health.pushDevicesNeedingRegistration > 0
    ? `${base} · re-enable notifications on this device`
    : base;
}

function WatchRow({
  watch,
  serverStatus,
  onPress,
}: {
  watch: CertWatch;
  serverStatus?: ServerTargetStatus;
  onPress: () => void;
}) {
  // Prefer the backend's authoritative change copy when it flagged something;
  // otherwise fall back to the local issuer/checked-at line.
  const needsAttention = serverStatus?.state === 'needs_attention';
  const serverChange = serverStatus?.changeTitle ?? null;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.rowLeft}>
        <View style={styles.rowMeta}>
          <Text style={styles.rowDomain}>{watch.domain}</Text>
          {watch.hasAlert && (
            <View style={styles.alertDot} />
          )}
        </View>
        {serverChange ? (
          <Text
            style={[styles.rowIssuer, needsAttention && styles.rowIssuerAlert]}
            numberOfLines={1}
          >
            {needsAttention ? '▲ ' : ''}{serverChange}
          </Text>
        ) : watch.certIssuer ? (
          <Text style={styles.rowIssuer} numberOfLines={1}>{watch.certIssuer}</Text>
        ) : (
          <Text style={styles.rowIssuer}>Not yet checked</Text>
        )}
        {watch.lastCheckedAt && (
          <Text style={styles.rowTime}>
            Checked {formatRelative(watch.lastCheckedAt)}
          </Text>
        )}
      </View>
      <ExpiryBadge days={watch.daysUntilExpiry} />
    </TouchableOpacity>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

function formatRelativeFuture(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(diff)) return 'soon';
  if (diff <= 0) return 'due now';
  const mins = Math.ceil(diff / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  return `in ${Math.round(hrs / 24)}d`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: colors.textPrimary, fontSize: typography.xl, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: typography.sm, marginTop: 2 },
  bgStatus: { color: colors.textMuted, fontSize: typography.xs, marginTop: 4 },
  statusSafe: { color: colors.safe },
  statusWarn: { color: colors.warning, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  attentionDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.warning,
  },
  attentionDotCritical: { backgroundColor: colors.critical },
  attentionText: { color: colors.warning, fontSize: typography.sm, fontWeight: '600' },
  list: { flex: 1 },
  emptyContainer: { flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: typography.lg, fontWeight: '700' },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.base,
    textAlign: 'center',
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowLeft: { flex: 1, marginRight: spacing.sm },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowDomain: { color: colors.textPrimary, fontSize: typography.base, fontWeight: '600' },
  alertDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.critical,
  },
  rowIssuer: { color: colors.textMuted, fontSize: typography.xs, marginTop: 2 },
  rowIssuerAlert: { color: colors.warning, fontWeight: '600' },
  rowTime: { color: colors.textMuted, fontSize: typography.xs, marginTop: 1 },
  healthFooter: {
    color: colors.textMuted,
    fontSize: typography.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
});
