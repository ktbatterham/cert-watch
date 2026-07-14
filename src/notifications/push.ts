/**
 * Remote push registration for Cert Watch.
 *
 * Cert Watch reads certificate data from crt.sh directly and has no SecURL API
 * client, but it still registers its native push token with the SecURL backend
 * so the server can deliver cert-expiry / renewal pushes directly (more
 * reliable than the throttled on-device background fetch). iOS registers its
 * APNs token; Android registers its FCM token, gated on the backend
 * advertising `android-fcm-push-v1` (capability appears only when FCM
 * credentials are configured server-side). Self-contained: it mints its own
 * anonymous owner token for the registration endpoint.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOwnerToken, getNotificationFeatures, CLIENT_HEADERS } from '../api/client';

const BASE_URL = 'https://securl-app-production.up.railway.app';
const APP_ID = 'com.ktbatterham.certwatch'; // becomes the apns-topic server-side
const REGISTERED_TOKEN_KEY = 'cw:registered-apns-token';
const REGISTERED_FCM_TOKEN_KEY = 'cw:registered-fcm-token';

/**
 * Fetch the device's native push token and register it with the backend.
 * Best-effort and idempotent (skips the call when the token is unchanged).
 * iOS requires the push entitlement (from the expo-notifications config
 * plugin); Android requires the Firebase config (google-services.json).
 */
export async function registerForRemotePush(): Promise<void> {
  if (Platform.OS === 'ios') return registerIosPush();
  if (Platform.OS === 'android') return registerAndroidPush();
}

async function registerIosPush(): Promise<void> {
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
      headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json', 'X-Scan-Owner': owner },
      body: JSON.stringify({ apnsToken, appId: APP_ID, environment }),
    });
    if (!res.ok) return; // best-effort; on-device checks still run

    await AsyncStorage.setItem(REGISTERED_TOKEN_KEY, apnsToken).catch(() => {});
  } catch {
    // Non-fatal — the app works without remote push.
  }
}

async function registerAndroidPush(): Promise<void> {
  try {
    // Capability gate: only register once the backend advertises Android FCM
    // delivery (notifications.features[] includes 'android-fcm-push-v1').
    const features = await getNotificationFeatures();
    if (!features?.includes('android-fcm-push-v1')) return;

    // Without google-services.json (not yet added — see MOBILE_BACKEND_CHANNEL
    // FCM handoff), getDevicePushTokenAsync() rejects on Android. The catch
    // below makes that a silent no-op, so the app behaves exactly as before
    // until the Firebase config lands; then this activates with no code change.
    const tokenResult = await Notifications.getDevicePushTokenAsync();
    const fcmToken = typeof tokenResult.data === 'string' ? tokenResult.data : '';
    if (!fcmToken) return;

    const prior = await AsyncStorage.getItem(REGISTERED_FCM_TOKEN_KEY).catch(() => null);
    if (prior === fcmToken) return; // already registered with this token

    const environment = __DEV__ ? 'sandbox' : 'production';
    const owner = await getOwnerToken();

    const res = await fetch(`${BASE_URL}/api/notification-devices`, {
      method: 'POST',
      headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json', 'X-Scan-Owner': owner },
      body: JSON.stringify({ platform: 'android', fcmToken, appId: APP_ID, environment }),
    });
    if (!res.ok) return; // best-effort; on-device checks still run

    await AsyncStorage.setItem(REGISTERED_FCM_TOKEN_KEY, fcmToken).catch(() => {});
  } catch {
    // Non-fatal — the app works without remote push (and this is the expected
    // path on Android until the Firebase config is added).
  }
}
