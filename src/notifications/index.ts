import * as Notifications from 'expo-notifications';
import type { CertEvent } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<void> {
  await Notifications.requestPermissionsAsync();
}

export async function scheduleCertNotification(event: CertEvent): Promise<void> {
  let title = '';
  let body = '';

  switch (event.eventType) {
    case 'expiring_soon':
      title = `Certificate expiring: ${event.domain}`;
      body = `Expires in ${event.daysUntilExpiry} day${event.daysUntilExpiry === 1 ? '' : 's'}. Renew before it lapses.`;
      break;
    case 'expired':
      title = `Certificate expired: ${event.domain}`;
      body = 'The TLS certificate has expired. Visitors will see a security warning.';
      break;
    case 'renewed':
      title = `Certificate renewed: ${event.domain}`;
      body = `New certificate from ${event.newIssuer ?? 'unknown issuer'}.`;
      break;
    case 'issuer_changed':
      title = `Certificate issuer changed: ${event.domain}`;
      body = `Was ${event.oldIssuer ?? 'unknown'}, now ${event.newIssuer ?? 'unknown'}.`;
      break;
    case 'unreachable':
      title = `Certificate check failed: ${event.domain}`;
      body = 'Could not retrieve certificate data. Check the domain is correct.';
      break;
  }

  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}
