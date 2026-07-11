import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import * as Notifications from 'expo-notifications';
import '../src/tasks/background';
import { requestNotificationPermissions } from '../src/notifications';
import { registerForRemotePush } from '../src/notifications/push';
import { registerBackgroundFetch } from '../src/tasks/background';
import { useOnboarding } from '../src/onboarding/useOnboarding';
import { Onboarding } from '../src/components/Onboarding';
import { loadWatches } from '../src/storage/watches';
import { colors } from '../src/theme';

export default function RootLayout() {
  const router = useRouter();
  const { seen, dismiss } = useOnboarding();

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
  // in Header Watch and SecURL.
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
        <Onboarding onDone={dismiss} />
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
