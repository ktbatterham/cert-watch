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
import { loadSettings, saveSettings, type CadenceHours } from '../src/storage/settings';
import { EXPIRY_WARN_DAYS } from '../src/tasks/checkCert';
import { sendTestNotification } from '../src/api/client';
import { haptics } from '../src/haptics';

const CADENCES: { hours: CadenceHours; label: string }[] = [
  { hours: 1, label: 'Hourly' },
  { hours: 6, label: 'Every 6h' },
  { hours: 24, label: 'Daily' },
];

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export default function SettingsScreen() {
  const [cadence, setCadence] = useState<CadenceHours | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => setCadence(s.defaultCadenceHours));
  }, []);

  const pickCadence = async (hours: CadenceHours) => {
    haptics.light();
    setCadence(hours);
    await saveSettings({ defaultCadenceHours: hours });
  };

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
                onPress={() => pickCadence(c.hours)}
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

      {/* Warning schedule */}
      <SectionLabel>Warning schedule</SectionLabel>
      <SectionCard>
        <Text style={styles.rowNote}>
          You’re alerted when a certificate crosses{' '}
          <Text style={styles.emphasis}>{warnList} days</Text> before expiry, and
          whenever a certificate expires, is renewed, changes issuer, or becomes
          unreachable.
        </Text>
      </SectionCard>

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
