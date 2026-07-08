// Named server-side expiry policy profiles (backend cert-policy-profiles-v1).
// `production` warns from 14 days out; `strict` and `renewal-watch` from 30.
// Absent/null = the legacy 30/14/7/1-day bands.
export type CertPolicy = 'production' | 'strict' | 'renewal-watch';

export interface CertWatch {
  id: string;
  domain: string;
  addedAt: string;
  lastCheckedAt: string | null;
  certSerial: string | null;
  certExpiry: string | null;
  certIssuer: string | null;
  daysUntilExpiry: number | null;
  hasAlert: boolean;
  checkIntervalHours: 1 | 6 | 24;
  // Named expiry policy sent to the backend when this watch's monitoring target
  // was created (null/undefined = legacy bands). Only sent when the backend
  // advertises cert-policy-profiles-v1.
  policy?: CertPolicy | null;
  // Id of the backend cert-monitoring target registered for this watch, so the
  // server scans the cert daily and pushes expiry/renewal/issuer events even when
  // the app is closed. `null` = registration was attempted but failed (retried on
  // next load); `undefined` = never attempted (watch predates server monitoring,
  // backfilled on load).
  serverTargetId?: string | null;
  // Tightest expiry-warning band (in days) we've already alerted on for the
  // current certificate, so repeat checks don't re-alert and skipped days still
  // fire once. Reset to null when the cert is renewed. Optional for watches
  // persisted before this field existed.
  lastWarnedThreshold?: number | null;
}

export type CertEventType =
  | 'expiring_soon'
  | 'expired'
  | 'renewed'
  | 'issuer_changed'
  | 'unreachable';

export interface CertEvent {
  id: string;
  watchId: string;
  domain: string;
  detectedAt: string;
  eventType: CertEventType;
  daysUntilExpiry: number | null;
  oldSerial: string | null;
  newSerial: string | null;
  oldIssuer: string | null;
  newIssuer: string | null;
  oldExpiry: string | null;
  newExpiry: string | null;
}

export interface CertInfo {
  serial: string;
  expiry: string;
  issuer: string;
  daysUntilExpiry: number;
}
