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
