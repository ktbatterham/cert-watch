/**
 * EcosystemCard — shown at the bottom of the confirm screen after adding a watch.
 * Cross-promotes Header Watch and securl.online without being intrusive.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';

const HEADER_WATCH_URL = 'https://apps.apple.com/us/app/header-watch/id6774599437';
const SECURL_URL = 'https://securl.online';

interface LinkRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sublabel: string;
  url: string;
}

function LinkRow({ icon, label, sublabel, url }: LinkRowProps) {
  return (
    <TouchableOpacity
      style={styles.linkRow}
      onPress={() => Linking.openURL(url)}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={18} color={colors.accentLight} />
      <View style={styles.linkText}>
        <Text style={styles.linkLabel}>{label}</Text>
        <Text style={styles.linkSublabel}>{sublabel}</Text>
      </View>
      <Ionicons name="open-outline" size={13} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export function EcosystemCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Also in the SecURL suite</Text>
      <LinkRow
        icon="eye-outline"
        label="Header Watch"
        sublabel="Monitor security header drift"
        url={HEADER_WATCH_URL}
      />
      <View style={styles.divider} />
      <LinkRow
        icon="shield-checkmark-outline"
        label="securl.online"
        sublabel="Full posture scan: headers, TLS, DNS, third-party"
        url={SECURL_URL}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heading: {
    color: colors.textMuted,
    fontSize: typography.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  linkText: {
    flex: 1,
    gap: 2,
  },
  linkLabel: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  linkSublabel: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: 2,
  },
});
