import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import '../src/tasks/background';
import { requestNotificationPermissions } from '../src/notifications';
import { registerForRemotePush } from '../src/notifications/push';
import { registerBackgroundFetch } from '../src/tasks/background';

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      await requestNotificationPermissions();
      registerBackgroundFetch();
      // Register this device's APNs token so the backend can push cert alerts.
      registerForRemotePush().catch(() => {});
    })();
  }, []);

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
