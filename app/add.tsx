import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../src/theme';
import { ExpiryBadge } from '../src/components/ExpiryBadge';
import { EcosystemCard } from '../src/components/EcosystemCard';
import { fetchCertInfo, warningBand } from '../src/tasks/checkCert';
import { useWatches } from '../src/hooks/useWatches';
import type { CertWatch, CertInfo } from '../src/types';

type Stage = 'input' | 'scanning' | 'confirm';

function sanitiseDomain(raw: string): string {
  return raw.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
}

export default function AddScreen() {
  const router = useRouter();
  const { add } = useWatches();

  const [domain, setDomain] = useState('');
  const [stage, setStage] = useState<Stage>('input');
  const [certInfo, setCertInfo] = useState<CertInfo | null>(null);

  const handleScan = async () => {
    const clean = sanitiseDomain(domain);
    if (!clean) return;
    setStage('scanning');
    try {
      const info = await fetchCertInfo(clean);
      setCertInfo(info);
      setStage('confirm');
    } catch (e: any) {
      setStage('input');
      Alert.alert('Scan failed', e.message ?? 'Could not retrieve certificate data.');
    }
  };

  const handleAdd = async () => {
    if (!certInfo) return;
    const clean = sanitiseDomain(domain);
    const watch: CertWatch = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      domain: clean,
      addedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      certSerial: certInfo.serial,
      certExpiry: certInfo.expiry,
      certIssuer: certInfo.issuer,
      daysUntilExpiry: certInfo.daysUntilExpiry,
      hasAlert: false,
      checkIntervalHours: 24,
      lastWarnedThreshold: warningBand(certInfo.daysUntilExpiry),
    };
    await add(watch);
    router.back();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="shield-checkmark-outline" size={40} color={colors.accentLight} />
      </View>

      <Text style={styles.heading}>Add a domain to watch</Text>
      <Text style={styles.sub}>
        We'll check the TLS certificate and alert you before it expires or changes.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="example.com"
        placeholderTextColor={colors.textMuted}
        value={domain}
        onChangeText={setDomain}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={stage === 'input'}
      />

      {stage === 'input' && (
        <TouchableOpacity
          style={[styles.btn, styles.primaryBtn, !domain.trim() && styles.btnDisabled]}
          onPress={handleScan}
          disabled={!domain.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>Check certificate</Text>
        </TouchableOpacity>
      )}

      {stage === 'scanning' && (
        <View style={styles.scanningRow}>
          <ActivityIndicator color={colors.accentLight} />
          <Text style={styles.scanningText}>Fetching certificate…</Text>
        </View>
      )}

      {stage === 'confirm' && certInfo && (
        <View style={styles.confirmCard}>
          <View style={styles.confirmRow}>
            <ExpiryBadge days={certInfo.daysUntilExpiry} size="lg" />
            <View style={styles.confirmMeta}>
              <Text style={styles.confirmDomain}>{sanitiseDomain(domain)}</Text>
              <Text style={styles.confirmIssuer}>{certInfo.issuer}</Text>
              <Text style={styles.confirmExpiry}>
                Expires {new Date(certInfo.expiry).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={handleAdd} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.btnText}>Add to watches</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.retryBtn} onPress={() => setStage('input')} activeOpacity={0.8}>
            <Text style={styles.retryText}>Try a different domain</Text>
          </TouchableOpacity>

          <EcosystemCard />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingTop: spacing.xl, gap: spacing.md },
  iconWrap: { alignItems: 'center', marginBottom: spacing.sm },
  heading: {
    color: colors.textPrimary,
    fontSize: typography.xl,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    marginTop: spacing.sm,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
  },
  primaryBtn: { backgroundColor: colors.accent },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: colors.textPrimary, fontSize: typography.base, fontWeight: '700' },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  scanningText: { color: colors.textSecondary, fontSize: typography.sm },
  confirmCard: { gap: spacing.md, marginTop: spacing.sm },
  confirmRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  confirmMeta: { flex: 1, gap: 3 },
  confirmDomain: { color: colors.textPrimary, fontSize: typography.md, fontWeight: '700' },
  confirmIssuer: { color: colors.textMuted, fontSize: typography.xs },
  confirmExpiry: { color: colors.textSecondary, fontSize: typography.xs },
  retryBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  retryText: { color: colors.textMuted, fontSize: typography.sm },
});
