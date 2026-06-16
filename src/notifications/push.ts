/**
 * Remote push registration for Cert Watch.
 *
 * Cert Watch reads certificate data from crt.sh directly and has no SecURL API
 * client, but it still registers its APNs token with the SecURL backend so the
 * server can deliver cert-expiry / renewal pushes directly via APNs (more
 * reliable than the throttled on-device background fetch). Self-contained: it
 * mints its own anonymous owner token for the registration endpoint.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOwnerToken } from '../api/client';

const BASE_URL = 'https://securl-app-production.up.railway.app';
const APP_ID = 'com.ktbatterham.certwatch'; // becomes the apns-topic server-side
const REGISTERED_TOKEN_KEY = 'cw:registered-apns-token';

/**
 * Fetch the device's native APNs token and register it with the backend.
 * Best-effort and idempotent (skips the call when the token is unchanged).
 * Requires the push entitlement (from the expo-notifications config plugin).
 */
export async function registerForRemotePush(): Promise<void> {
  if (Platform.OS !== 'ios') return; // backend delivers via APNs only
  try {
    const tokenResult = await Notifications.getDevicePushTokenAsync();
    const apnsToken = typeof tokenResult.data === 'string' ? tokenResult.data : '';
    if (!apnsToken) return;

    const prior = await AsyncStorage.getItem(REGISTERED_TOKEN_KEY).catch(() => null);
    if (prior === apnsToken) return; // already registered with this token

    // aps-environment is 'development' (sandbox) for dev builds, 'production' for
    // TestFlight + App Store builds.
    const environment = __DEV__ ? 'sandbox' : 'production';
    const owner = await getOwnerToken();

    const res = await fetch(`${BASE_URL}/api/notification-devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Scan-Owner': owner },
      body: JSON.stringify({ apnsToken, appId: APP_ID, environment }),
    });
    if (!res.ok) return; // best-effort; on-device checks still run

    await AsyncStorage.setItem(REGISTERED_TOKEN_KEY, apnsToken).catch(() => {});
  } catch {
    // Non-fatal — the app works without remote push.
  }
}
