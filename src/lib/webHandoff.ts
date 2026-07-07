/**
 * Mobile → web growth contract (backend MOBILE-WEB-GROWTH-CONTRACT.md).
 * Opens a full-posture SecURL scan of a domain in the hosted web app.
 * UTMs are aggregate + privacy-safe: they never carry the host, user, or device.
 */
import { Linking } from 'react-native';

const WEB_BASE = 'https://app.securl.online';
const SOURCE = 'cert_watch_ios';

function normalize(target: string): string {
  const t = target.trim();
  return t.startsWith('http') ? t : `https://${t}`;
}

export function scanHandoffUrl(target: string): string {
  return `${WEB_BASE}/?url=${encodeURIComponent(normalize(target))}` +
    `&utm_source=${SOURCE}&utm_medium=app&utm_campaign=mobile_handoff`;
}

/** Open the scanner handoff in the browser. Best-effort. */
export async function openScanHandoff(target: string): Promise<void> {
  try {
    await Linking.openURL(scanHandoffUrl(target));
  } catch {
    // Non-fatal.
  }
}
