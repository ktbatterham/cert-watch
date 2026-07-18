/**
 * EcosystemCard — cross-promotes the other two apps in the SecURL suite
 * (SecURL and Header Watch). Rendered on the home screen and on the
 * add-watch confirm screen. Platform-aware links: App Store on iOS,
 * securl.online/downloads on Android.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Image,
  Platform,
  type ImageSourcePropType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';

interface SuiteApp {
  icon: ImageSourcePropType;
  name: string;
  tagline: string;
  iosUrl: string;
}

const APPS: SuiteApp[] = [
  {
    icon: require('../../assets/suite/securl.png'),
    name: 'SecURL',
    tagline: 'A to F security posture grade for any URL',
    iosUrl: 'https://apps.apple.com/us/app/securl/id6774322464',
  },
  {
    icon: require('../../assets/suite/header-watch.png'),
    name: 'Header Watch',
    tagline: 'Monitor HTTP security header drift',
    iosUrl: 'https://apps.apple.com/us/app/header-watch/id6774599437',
  },
];

const ANDROID_URL = 'https://securl.online/downloads';

function AppRow({ app }: { app: SuiteApp }) {
  const url = Platform.OS === 'android' ? ANDROID_URL : app.iosUrl;
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => Linking.openURL(url)}
      activeOpacity={0.7}
      accessibilityRole="link"
      accessibilityLabel={`${app.name} — ${app.tagline}`}
    >
      <Image source={app.icon} style={styles.icon} />
      <View style={styles.rowText}>
        <Text style={styles.appName}>{app.name}</Text>
        <Text style={styles.tagline}>{app.tagline}</Text>
      </View>
      <Ionicons name="open-outline" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export function EcosystemCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>More from the SecURL suite</Text>
      {APPS.map((app, i) => (
        <React.Fragment key={app.name}>
          {i > 0 && <View style={styles.divider} />}
          <AppRow app={app} />
        </React.Fragment>
      ))}
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
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  appName: {
    color: colors.textPrimary,
    fontSize: typography.base,
    fontWeight: '700',
  },
  tagline: {
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
