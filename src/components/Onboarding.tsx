/**
 * First-run onboarding: three swipeable slides (what it does · passive/read-only ·
 * privacy), a page indicator, Skip, and a Next/Get started button. Shown once
 * (see useOnboarding). Copy honours the passive-first, no-account principle.
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'ribbon-outline',
    title: 'Never get caught by an expired cert',
    body: 'Cert Watch tracks the TLS certificates of the domains you rely on and warns you well before they expire, renew, or change issuer.',
  },
  {
    icon: 'eye-outline',
    title: 'Passive and read-only',
    body: 'It inspects only the public certificate a site presents to any visitor. It never attacks or changes anything, so it’s safe to watch any domain.',
  },
  {
    icon: 'lock-closed-outline',
    title: 'No account, no tracking',
    body: 'No sign-up, no ads, no tracking. Your watch list stays on your device.',
  },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const next = () => {
    if (last) {
      onDone();
      return;
    }
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <TouchableOpacity onPress={onDone} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pager}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.slide, { width }]}>
            <View style={styles.iconWrap}>
              <Ionicons name={s.icon} size={44} color={colors.accentLight} />
            </View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={styles.btn} onPress={next} activeOpacity={0.85}>
        <Text style={styles.btnText}>{last ? 'Get started' : 'Next'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  skip: {
    color: colors.textMuted,
    fontSize: typography.base,
    fontWeight: '600',
  },
  pager: {
    flexGrow: 0,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    backgroundColor: colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.xl,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.base,
    lineHeight: 24,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.accentLight,
    width: 22,
  },
  btn: {
    backgroundColor: colors.accent,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  btnText: {
    color: colors.textPrimary,
    fontSize: typography.base,
    fontWeight: '700',
  },
});
