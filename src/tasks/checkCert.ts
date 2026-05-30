import { loadWatches, updateWatch } from '../storage/watches';
import { addEvent } from '../storage/events';
import type { CertWatch, CertEvent, CertInfo } from '../types';

const EXPIRY_WARN_DAYS = [30, 14, 7, 1];

export async function fetchCertInfo(domain: string): Promise<CertInfo> {
  const url = `https://crt.sh/?identity=${encodeURIComponent(domain)}&output=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`crt.sh returned ${res.status}`);

  const data: Array<{
    serial_number: string;
    not_after: string;
    issuer_name: string;
    name_value: string;
  }> = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No certificates found for ${domain}`);
  }

  const now = new Date();
  const valid = data
    .filter((c) => {
      const names = c.name_value.split('\n');
      return names.includes(domain) || names.includes(`*.${domain.split('.').slice(1).join('.')}`);
    })
    .filter((c) => new Date(c.not_after) > now)
    .sort((a, b) => new Date(b.not_after).getTime() - new Date(a.not_after).getTime());

  const cert = valid[0] ?? data.sort((a, b) =>
    new Date(b.not_after).getTime() - new Date(a.not_after).getTime(),
  )[0];

  const expiry = new Date(cert.not_after);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
  const issuer = cert.issuer_name.match(/CN=([^,]+)/)?.[1] ?? cert.issuer_name;

  return {
    serial: cert.serial_number,
    expiry: cert.not_after,
    issuer,
    daysUntilExpiry,
  };
}

export function isDue(watch: CertWatch): boolean {
  if (!watch.lastCheckedAt) return true;
  const elapsed = Date.now() - new Date(watch.lastCheckedAt).getTime();
  return elapsed >= watch.checkIntervalHours * 3_600_000;
}

export async function checkCert(watch: CertWatch): Promise<CertEvent | null> {
  let certInfo: CertInfo;

  try {
    certInfo = await fetchCertInfo(watch.domain);
  } catch {
    const event: CertEvent = {
      id: `${Date.now()}-${watch.id}`,
      watchId: watch.id,
      domain: watch.domain,
      detectedAt: new Date().toISOString(),
      eventType: 'unreachable',
      daysUntilExpiry: null,
      oldSerial: watch.certSerial,
      newSerial: null,
      oldIssuer: watch.certIssuer,
      newIssuer: null,
      oldExpiry: watch.certExpiry,
      newExpiry: null,
    };
    const updated: CertWatch = {
      ...watch,
      lastCheckedAt: new Date().toISOString(),
      hasAlert: true,
    };
    await updateWatch(updated);
    await addEvent(event);
    return event;
  }

  const updated: CertWatch = {
    ...watch,
    lastCheckedAt: new Date().toISOString(),
    certSerial: certInfo.serial,
    certExpiry: certInfo.expiry,
    certIssuer: certInfo.issuer,
    daysUntilExpiry: certInfo.daysUntilExpiry,
    hasAlert: false,
  };

  let event: CertEvent | null = null;

  // Certificate renewed or replaced
  if (watch.certSerial && watch.certSerial !== certInfo.serial) {
    const eventType = certInfo.daysUntilExpiry <= 0 ? 'expired' : 'renewed';
    event = {
      id: `${Date.now()}-${watch.id}`,
      watchId: watch.id,
      domain: watch.domain,
      detectedAt: new Date().toISOString(),
      eventType,
      daysUntilExpiry: certInfo.daysUntilExpiry,
      oldSerial: watch.certSerial,
      newSerial: certInfo.serial,
      oldIssuer: watch.certIssuer,
      newIssuer: certInfo.issuer,
      oldExpiry: watch.certExpiry,
      newExpiry: certInfo.expiry,
    };
    updated.hasAlert = eventType !== 'renewed';
  } else if (certInfo.daysUntilExpiry <= 0) {
    event = {
      id: `${Date.now()}-${watch.id}`,
      watchId: watch.id,
      domain: watch.domain,
      detectedAt: new Date().toISOString(),
      eventType: 'expired',
      daysUntilExpiry: certInfo.daysUntilExpiry,
      oldSerial: watch.certSerial,
      newSerial: certInfo.serial,
      oldIssuer: watch.certIssuer,
      newIssuer: certInfo.issuer,
      oldExpiry: watch.certExpiry,
      newExpiry: certInfo.expiry,
    };
    updated.hasAlert = true;
  } else if (EXPIRY_WARN_DAYS.includes(certInfo.daysUntilExpiry)) {
    event = {
      id: `${Date.now()}-${watch.id}`,
      watchId: watch.id,
      domain: watch.domain,
      detectedAt: new Date().toISOString(),
      eventType: 'expiring_soon',
      daysUntilExpiry: certInfo.daysUntilExpiry,
      oldSerial: watch.certSerial,
      newSerial: certInfo.serial,
      oldIssuer: watch.certIssuer,
      newIssuer: certInfo.issuer,
      oldExpiry: watch.certExpiry,
      newExpiry: certInfo.expiry,
    };
    updated.hasAlert = true;
  }

  await updateWatch(updated);
  if (event) await addEvent(event);
  return event;
}
