import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../../src/theme';
import { ExpiryBadge } from '../../src/components/ExpiryBadge';
import { useWatches } from '../../src/hooks/useWatches';
import { sendTestNotification } from '../../src/api/client';
import { haptics } from '../../src/haptics';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { BACKGROUND_FETCH_TASK } from '../../src/tasks/background';
import type { CertWatch } from '../../src/types';

export default function WatchesScreen() {
  const router = useRouter();
  const { watches, load } = useWatches();
  const [refreshing, setRefreshing] = useState(false);
  const [bgStatus, setBgStatus] = useState<string>('');
  const [testing, setTesting] = useState(false);

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
        {bgStatus && (
          <Text style={styles.bgStatus}>
            {bgStatus === 'active'
              ? '● Background checks active'
              : bgStatus === 'pending'
              ? '○ Background checks pending'
              : '○ Background checks unavailable'}
          </Text>
        )}
      </View>

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
          watches.map((watch) => (
            <WatchRow
              key={watch.id}
              watch={watch}
              onPress={() => { haptics.light(); router.push(`/watch/${watch.id}`); }}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function WatchRow({ watch, onPress }: { watch: CertWatch; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.rowLeft}>
        <View style={styles.rowMeta}>
          <Text style={styles.rowDomain}>{watch.domain}</Text>
          {watch.hasAlert && (
            <View style={styles.alertDot} />
          )}
        </View>
        {watch.certIssuer ? (
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
  rowTime: { color: colors.textMuted, fontSize: typography.xs, marginTop: 1 },
});
