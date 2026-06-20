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
import type { CertInfo } from '../types';

const BASE_URL = 'https://securl-app-production.up.railway.app';
const OWNER_TOKEN_KEY = 'cw:scan-owner-token';
const APP_ID = 'com.ktbatterham.certwatch'; // becomes the apns-topic server-side

// Product-telemetry headers sent on every SecURL-backend call so the engine can
// attribute usage by app/release (never by device or install). Additive: the
// backend ignores them if absent or malformed. Not sent to crt.sh (third party).
// version+build comes from the installed binary. Reused by the push module.
export const CLIENT_HEADERS: Record<string, string> = {
  'X-SecURL-Client': 'cert-watch-ios',
  'X-SecURL-Client-Version': `${Application.nativeApplicationVersion ?? '0'}+${Application.nativeBuildVersion ?? '0'}`,
};

// Stable anonymous identifier the backend uses to scope requests (>= 24 chars,
// decent entropy). Not a secret. Shared with the push module via the same key.
let cachedOwner: string | null = null;

export async function getOwnerToken(): Promise<string> {
  if (cachedOwner) return cachedOwner;
  try {
    const stored = await AsyncStorage.getItem(OWNER_TOKEN_KEY);
    if (stored) {
      cachedOwner = stored;
      return stored;
    }
  } catch {
    // fall through and mint a session-only token
  }
  const seg = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2));
  const token = `cw-${Date.now().toString(36)}-${seg.join('')}`.slice(0, 120);
  cachedOwner = token;
  try {
    await AsyncStorage.setItem(OWNER_TOKEN_KEY, token);
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

    const parsed = new Date(c.validTo);
    const expiry = Number.isNaN(parsed.getTime()) ? c.validTo : parsed.toISOString();

    return {
      serial: c.serialNumber,
      expiry,
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
