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
