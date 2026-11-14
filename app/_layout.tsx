import { Stack, useRouter, usePathname, useRootNavigationState } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import '../src/tasks/background';
import { requestNotificationPermissions } from '../src/notifications';
import { registerForRemotePush } from '../src/notifications/push';
import { registerBackgroundFetch } from '../src/tasks/background';
import { useOnboarding } from '../src/onboarding/useOnboarding';
import { Onboarding, type OnboardingExit } from '../src/components/Onboarding';
import { loadWatches } from '../src/storage/watches';
import { colors } from '../src/theme';

// Privacy-safe crash reporting: no PII, no user identity, no tracing, and no
// custom context (watched domains and owner tokens must never reach Sentry).
Sentry.init({
  dsn: 'https://094f68f5d75a0d3e1700b9dc24434529@o4511729899601920.ingest.de.sentry.io/4511729999544400',
  enabled: !__DEV__,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  environment: __DEV__ ? 'development' : 'production',
});

function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const rootNavState = useRootNavigationState();
  const { seen, dismiss } = useOnboarding();

  // "Get started" on the last onboarding slide lands the user on Add (their
  // first watch) instead of an empty home list; Skip keeps the home landing.
  // The Stack only mounts once `seen` flips true, so we can't navigate inside
  // onDone. Instead record the intent and push in an effect after the Stack
  // has rendered. The flag is cleared before navigating, so it fires once.
  const [pendingAddAfterOnboarding, setPendingAddAfterOnboarding] = useState(false);
  const finishOnboarding = useCallback(
    (exit: OnboardingExit) => {
      if (exit === 'start') setPendingAddAfterOnboarding(true);
      dismiss();
    },
    [dismiss],
  );
  useEffect(() => {
    if (!pendingAddAfterOnboarding || seen !== true || !rootNavState?.key) return;
    setPendingAddAfterOnboarding(false);
    // A first launch from a deep link (certwatch://add?domain=...) is already
    // on Add with its pre-fill; pushing again would stack a blank copy on top.
    if (pathname === '/add') return;
    router.push('/add');
  }, [pendingAddAfterOnboarding, seen, rootNavState?.key, pathname, router]);

  // Ask for notification permission + register background/push only AFTER
  // onboarding — don't prompt before the app has explained what it does.
  useEffect(() => {
    if (seen !== true) return;
    (async () => {
      await requestNotificationPermissions();
      registerBackgroundFetch();
      registerForRemotePush().catch(() => {});
    })();
  }, [seen]);

  // Tapping a cert push (or a local expiry/renewal notification) opens the
  // matching watch. Cert Watch had no push-tap routing before this — the
  // backend's cert APNs payloads carry top-level targetId/eventId (mobile-
  // monitoring-explanations-v1) alongside host; local notifications now carry
  // watchId/eventId (see src/notifications/index.ts). Route by targetId/watchId
  // first, falling back to host/domain — matching the pattern already shipped
  // in Header Watch and SecURL. Android note: FCM delivers nested `data` object
  // fields JSON-string encoded, but everything read here is a top-level string
  // (host/targetId/watchId/eventId), which arrives as-is on both platforms —
  // no parse fallback needed.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response.notification.request.content.data as Record<string, unknown>;
        const host = typeof data?.host === 'string' ? data.host : null;
        const targetId = typeof data?.targetId === 'string' ? data.targetId : null;
        const watchId = typeof data?.watchId === 'string' ? data.watchId : null;
        const eventId = typeof data?.eventId === 'string' ? data.eventId : null;
        loadWatches()
          .then((ws) => {
            const match = ws.find(
              (w) =>
                (watchId && w.id === watchId) ||
                (targetId && w.serverTargetId === targetId) ||
                (host && w.domain === host),
            );
            if (match) {
              router.push(
                eventId
                  ? `/watch/${match.id}?eventId=${encodeURIComponent(eventId)}`
                  : `/watch/${match.id}`,
              );
            } else {
              router.push('/');
            }
          })
          .catch(() => {});
      } catch {
        // ignore malformed payloads
      }
    });
    return () => sub.remove();
  }, [router]);

  if (seen === null) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  if (seen === false) {
    return (
      <>
        <StatusBar style="light" />
        <Onboarding onDone={finishOnboarding} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Add Watch',
            headerStyle: { backgroundColor: '#070b14' },
            headerTintColor: '#f1f5f9',
          }}
        />
        <Stack.Screen
          name="watch/[id]"
          options={{
            headerShown: true,
            headerTitle: '',
            headerStyle: { backgroundColor: '#070b14' },
            headerTintColor: '#f1f5f9',
            headerBackTitle: 'Watches',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            headerTitle: 'Settings',
            headerStyle: { backgroundColor: '#070b14' },
            headerTintColor: '#f1f5f9',
            headerBackTitle: 'Watches',
          }}
        />
      </Stack>
    </>
  );
}

export default Sentry.wrap(RootLayout);
