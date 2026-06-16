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
import type { CertInfo } from '../types';

const BASE_URL = 'https://securl-app-production.up.railway.app';
const OWNER_TOKEN_KEY = 'cw:scan-owner-token';

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
      headers: { 'X-Scan-Owner': owner },
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
