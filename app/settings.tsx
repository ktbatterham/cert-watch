import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import * as Application from 'expo-application';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../src/theme';
import { SectionCard } from '../src/components/SectionCard';
import {
  loadSettings,
  saveSettings,
  type CadenceHours,
  type CertWatchSettings,
} from '../src/storage/settings';
import { EXPIRY_WARN_DAYS } from '../src/tasks/checkCert';
import { sendTestNotification, getMonitoringFeatures } from '../src/api/client';
import type { CertPolicy } from '../src/types';
import { haptics } from '../src/haptics';

const CADENCES: { hours: CadenceHours; label: string }[] = [
  { hours: 1, label: 'Hourly' },
  { hours: 6, label: 'Every 6h' },
  { hours: 24, label: 'Daily' },
];

// null = legacy 30/14/7/1-day bands.
const POLICIES: { value: CertPolicy | null; label: string; detail: string }[] = [
  { value: null, label: 'Default', detail: 'Warn at 30, 14, 7, and 1 days before expiry.' },
  { value: 'production', label: 'Production', detail: 'Warn from 14 days out. Best for live services.' },
  { value: 'strict', label: 'Strict', detail: 'Warn from 30 days out. Extra lead time.' },
  { value: 'renewal-watch', label: 'Renewal watch', detail: 'Warn from 30 days out, renewal-focused.' },
];

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<CertWatchSettings | null>(null);
  const [policyGated, setPolicyGated] = useState(false); // backend advertises profiles
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSettings().then(setSettings);
    getMonitoringFeatures().then((f) =>
      setPolicyGated(!!f?.includes('cert-policy-profiles-v1')),
    );
  }, []);

  const update = async (patch: Partial<CertWatchSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    haptics.light();
    setSettings(next);
    await saveSettings(next);
  };

  const cadence = settings?.defaultCadenceHours ?? null;
  const policy = settings?.defaultCertPolicy ?? null;

  const handleTest = () => {
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
            result.ok ? haptics.success() : haptics.warning();
            Alert.alert(result.ok ? 'Sent' : 'Not sent', result.message);
          },
        },
      ],
    );
  };

  const version = Application.nativeApplicationVersion ?? '1.0';
  const build = Application.nativeBuildVersion ?? '';
  const warnList = EXPIRY_WARN_DAYS.join(', ');

  if (!settings) {
    return (
      <View style={[styles.screen, styles.loading]}>
        <ActivityIndicator color={colors.accentLight} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Monitoring */}
      <SectionLabel>Monitoring</SectionLabel>
      <SectionCard>
        <Text style={styles.rowTitle}>Default check frequency</Text>
        <Text style={styles.rowNote}>
          Applied to new domains you add. Each watch can still be changed individually.
        </Text>
        <View style={styles.segment}>
          {CADENCES.map((c) => {
            const active = cadence === c.hours;
            return (
              <TouchableOpacity
                key={c.hours}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => update({ defaultCadenceHours: c.hours })}
                activeOpacity={0.8}
                accessibilityLabel={`Set default check frequency to ${c.label}`}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SectionCard>

      {/* Warning policy — server-backed named profiles when supported, else the
          read-only legacy schedule. */}
      {policyGated ? (
        <>
          <SectionLabel>Warning policy</SectionLabel>
          <SectionCard>
            <Text style={styles.rowNote}>
              Applied to new domains you add. Sets the server-side expiry warning
              thresholds. Existing watches keep their current policy.
            </Text>
            <View style={styles.policyList}>
              {POLICIES.map((p) => {
                const active = policy === p.value;
                return (
                  <TouchableOpacity
                    key={p.label}
                    style={[styles.policyRow, active && styles.policyRowActive]}
                    onPress={() => update({ defaultCertPolicy: p.value })}
                    activeOpacity={0.8}
                    accessibilityLabel={`Set default certificate policy to ${p.label}`}
                  >
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={active ? colors.accentLight : colors.textMuted}
                    />
                    <View style={styles.policyMeta}>
                      <Text style={styles.policyLabel}>{p.label}</Text>
                      <Text style={styles.policyDetail}>{p.detail}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </SectionCard>
        </>
      ) : (
        <>
          <SectionLabel>Warning schedule</SectionLabel>
          <SectionCard>
            <Text style={styles.rowNote}>
              You’re alerted when a certificate crosses{' '}
              <Text style={styles.emphasis}>{warnList} days</Text> before expiry, and
              whenever a certificate expires, is renewed, changes issuer, or becomes
              unreachable.
            </Text>
          </SectionCard>
        </>
      )}

      {/* Notifications */}
      <SectionLabel>Notifications</SectionLabel>
      <SectionCard>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleTest}
          disabled={testing}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={18} color={colors.accentLight} />
          <Text style={styles.actionText}>Send a test notification</Text>
          {testing ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          )}
        </TouchableOpacity>
        <Text style={[styles.rowNote, styles.notifNote]}>
          Alerts are delivered by the monitoring service even when the app is closed.
          Manage permission in the iOS Settings app.
        </Text>
      </SectionCard>

      {/* About */}
      <SectionLabel>About</SectionLabel>
      <SectionCard>
        <View style={styles.aboutRow}>
          <Text style={styles.rowTitle}>Version</Text>
          <Text style={styles.aboutValue}>
            {version}{build ? ` (${build})` : ''}
          </Text>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL('https://securl.online/privacy').catch(() => {})}
          activeOpacity={0.8}
        >
          <Text style={styles.linkText}>Privacy policy</Text>
          <Ionicons name="open-outline" size={15} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL('https://securl.online').catch(() => {})}
          activeOpacity={0.8}
        >
          <Text style={styles.linkText}>securl.online</Text>
          <Ionicons name="open-outline" size={15} color={colors.textMuted} />
        </TouchableOpacity>
      </SectionCard>

      <Text style={styles.footer}>
        Cert Watch is passive and read-only. It inspects only the public certificate a
        site presents to any visitor, needs no account, and keeps your watch list on
        your device.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.lg * 2, gap: spacing.xs },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: typography.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  rowTitle: { color: colors.textPrimary, fontSize: typography.base, fontWeight: '600' },
  rowNote: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    lineHeight: 20,
    marginTop: 4,
  },
  emphasis: { color: colors.textPrimary, fontWeight: '600' },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: colors.accentBg, borderColor: colors.accent },
  segmentText: { color: colors.textSecondary, fontSize: typography.sm, fontWeight: '600' },
  segmentTextActive: { color: colors.accentLight },
  policyList: { marginTop: spacing.sm, gap: spacing.xs },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  policyRowActive: { backgroundColor: colors.accentBg, borderColor: colors.accent },
  policyMeta: { flex: 1, gap: 1 },
  policyLabel: { color: colors.textPrimary, fontSize: typography.base, fontWeight: '600' },
  policyDetail: { color: colors.textSecondary, fontSize: typography.xs, lineHeight: 16 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionText: { flex: 1, color: colors.textPrimary, fontSize: typography.base },
  notifNote: { marginTop: spacing.sm },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aboutValue: { color: colors.textSecondary, fontSize: typography.base },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm + 2 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkText: { color: colors.accentLight, fontSize: typography.base, fontWeight: '500' },
  footer: {
    color: colors.textMuted,
    fontSize: typography.xs,
    lineHeight: 18,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
});
