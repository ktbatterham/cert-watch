/**
 * SecURL backend client for Cert Watch.
 *
 * Cert Watch is otherwise independent (crt.sh), but the SecURL backend exposes a
 * live-cert endpoint that does a real TLS handshake and returns the *served*
 * certificate — more accurate than crt.sh, which lists certs that were *issued*
 * (a host can serve an old/misconfigured cert that's perfectly valid in CT logs).
 * We use this as the primary source and fall back to crt.sh when it's
 * unavailable, so the app keeps working if the backend is down.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { CertInfo } from '../types';

const BASE_URL = 'https://securl-app-production.up.railway.app';
const OWNER_TOKEN_KEY = 'cw_scan_owner_token';        // SecureStore key (no ':')
const LEGACY_OWNER_TOKEN_KEY = 'cw:scan-owner-token'; // old AsyncStorage key — migrated once
const APP_ID = 'com.ktbatterham.certwatch'; // becomes the apns-topic server-side

// Product-telemetry headers sent on every SecURL-backend call so the engine can
// attribute usage by app/release (never by device or install). Additive: the
// backend ignores them if absent or malformed. Not sent to crt.sh (third party).
// version+build comes from the installed binary. Reused by the push module.
export const CLIENT_HEADERS: Record<string, string> = {
  'X-SecURL-Client': 'cert-watch-ios',
  'X-SecURL-Client-Version': `${Application.nativeApplicationVersion ?? '0'}+${Application.nativeBuildVersion ?? '0'}`,
  // Release channel for telemetry splits. __DEV__ covers dev/simulator builds;
  // everything else is a store install. (TestFlight is not reliably
  // distinguishable from the App Store on-device, so it reports as app-store.)
  'X-SecURL-Client-Channel': __DEV__ ? 'development' : 'app-store',
};

// Stable anonymous identifier the backend uses to scope requests (>= 24 chars,
// decent entropy). Not a secret. Shared with the push module via the same key.
let cachedOwner: string | null = null;

// Crypto-secure owner token: 24 CSPRNG bytes → 48 hex chars (within the backend's
// 24–256 char / >=8-distinct requirement). expo-crypto, not Math.random.
async function cryptoToken(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(24);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getOwnerToken(): Promise<string> {
  if (cachedOwner) return cachedOwner;
  // 1 — secure storage (iOS Keychain / Android Keystore)
  try {
    const secure = await SecureStore.getItemAsync(OWNER_TOKEN_KEY);
    if (secure) { cachedOwner = secure; return secure; }
  } catch {
    // SecureStore unavailable — fall through.
  }
  // 2 — migrate a pre-existing AsyncStorage token so existing installs keep their
  //     server-side registration (cert watches / notification device).
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_OWNER_TOKEN_KEY);
    if (legacy) {
      cachedOwner = legacy;
      await SecureStore.setItemAsync(OWNER_TOKEN_KEY, legacy).catch(() => {});
      await AsyncStorage.removeItem(LEGACY_OWNER_TOKEN_KEY).catch(() => {});
      return legacy;
    }
  } catch {
    // Fall through and mint a fresh token.
  }
  // 3 — fresh install: mint a crypto-random token
  const token = await cryptoToken();
  cachedOwner = token;
  try {
    await SecureStore.setItemAsync(OWNER_TOKEN_KEY, token);
  } catch {
    // non-fatal
  }
  return token;
}

interface LiveCertResponse {
  certificate?: {
    available?: boolean;
    issuer?: string;
    validTo?: string;
    daysRemaining?: number;
    serialNumber?: string;
  };
}

// Node's TLS layer (the backend's source) formats validTo like
// "Aug 24 01:37:14 2026 GMT". Hermes only reliably parses ISO 8601, so on-device
// `new Date(validTo)` returns NaN and the UI rendered "Invalid Date" (shipped bug,
// found by a real user on 1.0.4). Normalise to ISO here: try the engine first,
// then parse the openssl format explicitly, then derive from daysRemaining —
// which always yields a parseable ISO string.
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function toIsoExpiry(validTo: string, daysRemaining: number): string {
  const direct = new Date(validTo);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();
  const m = validTo.match(/^(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})\s+GMT$/i);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month !== undefined) {
      const utc = Date.UTC(Number(m[6]), month, Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
      if (!Number.isNaN(utc)) return new Date(utc).toISOString();
    }
  }
  // Last resort: approximate from the (always-numeric) day count.
  return new Date(Date.now() + daysRemaining * 86_400_000).toISOString();
}

/**
 * Fetch the authoritative *served* certificate via GET /api/certificates/live.
 * Returns null on any failure (network, non-200, no cert) so the caller can fall
 * back to crt.sh. The expiry is normalised to ISO for consistency with the crt.sh
 * path, which the UI parses with `new Date(...)`.
 */
export async function fetchLiveCertInfo(domain: string): Promise<CertInfo | null> {
  try {
    const owner = await getOwnerToken();
    const url = `${BASE_URL}/api/certificates/live?url=${encodeURIComponent(`https://${domain}`)}`;
    const res = await fetch(url, {
      headers: { ...CLIENT_HEADERS, 'X-Scan-Owner': owner },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as LiveCertResponse;
    const c = data.certificate;
    if (!c || c.available === false || !c.serialNumber || !c.validTo || c.daysRemaining == null) {
      return null;
    }

    return {
      serial: c.serialNumber,
      expiry: toIsoExpiry(c.validTo, c.daysRemaining),
      issuer: c.issuer ?? 'Unknown',
      daysUntilExpiry: c.daysRemaining,
    };
  } catch {
    return null;
  }
}

/**
 * Register a domain as a backend cert-monitoring target so the server checks the
 * served certificate daily and pushes expiry/renewal/issuer events via APNs —
 * reliable even when the app is closed (unlike the throttled on-device fetch).
 * Best-effort: returns the target id, or null on any failure (the local checker
 * still runs). Idempotent on the backend per (owner, host, kind).
 */
export async function createCertMonitoringTarget(domain: string): Promise<string | null> {
  try {
    const owner = await getOwnerToken();
    const res = await fetch(`${BASE_URL}/api/monitoring-targets`, {
      method: 'POST',
      headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json', 'X-Scan-Owner': owner },
      body: JSON.stringify({ url: `https://${domain}`, kind: 'cert', cadence: 'daily', appId: APP_ID }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { target?: { id?: string } };
    return data.target?.id ?? null;
  } catch {
    return null;
  }
}

export interface CertHistoryEntry {
  checkedAt: string;
  eventType: string | null; // null = routine check, no change
  daysRemaining: number | null;
  serialNumber: string | null;
  issuer: string | null;
  validTo: string | null;
  reachable: boolean;
}

interface TargetHistoryResponse {
  target?: { cert?: { history?: CertHistoryEntry[] } };
}

/**
 * Fetch the backend's authoritative monitoring timeline for a cert target —
 * every check it has run, with the event (if any) it detected. This is the
 * server's record across all the days the app was closed, unlike the on-device
 * event log. Newest first. Returns [] on any failure.
 */
export async function fetchCertTargetHistory(targetId: string): Promise<CertHistoryEntry[]> {
  try {
    const owner = await getOwnerToken();
    const res = await fetch(
      `${BASE_URL}/api/monitoring-targets/${encodeURIComponent(targetId)}/history`,
      { headers: { ...CLIENT_HEADERS, 'X-Scan-Owner': owner }, signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as TargetHistoryResponse;
    const history = data.target?.cert?.history ?? [];
    return [...history].sort(
      (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
    );
  } catch {
    return [];
  }
}

// ── Capabilities + owner-scoped cert summary ─────────────────────────────────
// The backend advertises additive features via GET /api/capabilities so clients
// can discover endpoints instead of assuming them (CONSUMER-API-MAP guidance).
// Cached for the app session; a failed fetch just disables gated features.

let cachedMonitoringFeatures: string[] | null | undefined;

export async function getMonitoringFeatures(): Promise<string[] | null> {
  if (cachedMonitoringFeatures !== undefined) return cachedMonitoringFeatures;
  try {
    const res = await fetch(`${BASE_URL}/api/capabilities`, {
      headers: CLIENT_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    // Only cache a SUCCESSFUL read. A transient failure/malformed response must
    // NOT be cached, or a single network blip at launch would disable the gated
    // enrichment for the whole session; leaving it uncached lets it retry.
    if (!res.ok) return null;
    const data = (await res.json()) as { monitoring?: { features?: unknown } };
    const features = data.monitoring?.features;
    if (!Array.isArray(features)) return null;
    cachedMonitoringFeatures = features.filter((f): f is string => typeof f === 'string');
    return cachedMonitoringFeatures;
  } catch {
    return null;
  }
}

// The owner-scoped Cert Watch home-screen summary (backend 1.15.x,
// GET /api/monitoring-cert-summary). We deliberately consume only the compact
// `summary` counts and `push` health — the fields the home screen renders —
// to keep the shape surface minimal. Everything is defensively coerced.
export interface CertServerSummary {
  totalCerts: number;
  needsAttention: number;
  expiringCerts: number;
  expiredCerts: number;
  unreachableCerts: number;
  nextCheckAt: string | null;
  pushConfigured: boolean;
  pushReady: boolean;
}

function asCount(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function fetchCertServerSummary(): Promise<CertServerSummary | null> {
  try {
    const features = await getMonitoringFeatures();
    if (!features?.includes('cert-watchlist-summary-v1')) return null;
    const owner = await getOwnerToken();
    const res = await fetch(`${BASE_URL}/api/monitoring-cert-summary`, {
      headers: { ...CLIENT_HEADERS, 'X-Scan-Owner': owner },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      summary?: Record<string, unknown>;
      push?: { configured?: unknown; readyDevices?: unknown };
    };
    const s = data.summary;
    if (!s || typeof s !== 'object') return null;
    return {
      totalCerts: asCount(s.totalCerts),
      needsAttention: asCount(s.needsAttention),
      expiringCerts: asCount(s.expiringCerts),
      expiredCerts: asCount(s.expiredCerts),
      unreachableCerts: asCount(s.unreachableCerts),
      nextCheckAt: typeof s.nextCheckAt === 'string' ? s.nextCheckAt : null,
      pushConfigured: data.push?.configured === true,
      pushReady: asCount(data.push?.readyDevices) > 0,
    };
  } catch {
    return null;
  }
}

/** Stop server-side monitoring for a target. Best-effort. */
export async function deleteMonitoringTarget(id: string): Promise<void> {
  try {
    const owner = await getOwnerToken();
    await fetch(`${BASE_URL}/api/monitoring-targets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { ...CLIENT_HEADERS, 'X-Scan-Owner': owner },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    // Best-effort.
  }
}

export interface TestNotificationResult {
  ok: boolean;
  message: string;
}

interface DeviceListResponse {
  devices?: Array<{ id?: string; appId?: string }>;
}

/**
 * Ask the backend to send a test push to this device, so the user can confirm the
 * whole push pipeline (APNs registration → delivery) on demand rather than waiting
 * for a real cert event. Per BACKEND-API.md the test endpoint is keyed by the
 * registration id (POST /api/notification-devices/:id/test, owner-scoped), so we
 * first look up this app's registration via the list (the raw token is never
 * echoed; we match on appId, falling back to the owner's only device).
 */
export async function sendTestNotification(): Promise<TestNotificationResult> {
  try {
    const owner = await getOwnerToken();
    const headers = { ...CLIENT_HEADERS, 'X-Scan-Owner': owner };

    const listRes = await fetch(`${BASE_URL}/api/notification-devices`, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!listRes.ok) {
      return { ok: false, message: 'Could not check your device registration. Try again shortly.' };
    }
    const { devices = [] } = (await listRes.json()) as DeviceListResponse;
    const device = devices.find((d) => d.appId === APP_ID) ?? devices[0];
    if (!device?.id) {
      return { ok: false, message: "This device isn't registered for notifications yet. Allow notifications, reopen the app, then try again." };
    }

    const res = await fetch(`${BASE_URL}/api/notification-devices/${encodeURIComponent(device.id)}/test`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      return { ok: true, message: 'Test notification sent. It should arrive on your device shortly.' };
    }
    if (res.status === 503) {
      return { ok: false, message: "The server couldn't deliver the test push right now. Try again shortly." };
    }
    if (res.status === 404) {
      return { ok: false, message: 'Your registration was not found. Reopen the app to re-register, then try again.' };
    }
    return { ok: false, message: `Couldn't send a test notification (server ${res.status}).` };
  } catch {
    return { ok: false, message: 'Could not reach the server. Check your connection.' };
  }
}
