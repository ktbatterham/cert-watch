import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../src/theme';
import { loadEvents } from '../../src/storage/events';
import { CertEventRow } from '../../src/components/CertEventRow';
import type { CertEvent } from '../../src/types';

export default function EventsScreen() {
  const [events, setEvents] = useState<CertEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await loadEvents();
    setEvents(data.sort((a, b) =>
      new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
    ));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Events</Text>
        <Text style={styles.subtitle}>
          {events.length === 0
            ? 'No events yet'
            : `${events.length} event${events.length === 1 ? '' : 's'}`}
        </Text>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={events.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accentLight}
          />
        }
      >
        {events.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptyText}>
              Certificate renewals, expiry warnings, and issuer changes will appear here.
            </Text>
          </View>
        ) : (
          events.map((event) => <CertEventRow key={event.id} event={event} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: { color: colors.textPrimary, fontSize: typography.xl, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: typography.sm, marginTop: 2 },
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
});
