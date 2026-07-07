import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import '../src/tasks/background';
import { requestNotificationPermissions } from '../src/notifications';
import { registerForRemotePush } from '../src/notifications/push';
import { registerBackgroundFetch } from '../src/tasks/background';
import { useOnboarding } from '../src/onboarding/useOnboarding';
import { Onboarding } from '../src/components/Onboarding';
import { colors } from '../src/theme';

export default function RootLayout() {
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
      </Stack>
    </>
  );
}
