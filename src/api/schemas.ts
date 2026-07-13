// ── Runtime boundary validation ────────────────────────────────────────────
//
// Cert Watch has no `normalizeResult()` shim (it never reads the raw full
// scan object — only the purpose-built cert endpoints), but its primary data
// path, `GET /api/certificates/live`, previously validated the response with
// a bare `as LiveCertResponse` type cast: TypeScript enforced nothing at
// runtime, and a field rename would silently degrade to "no live cert" with
// zero visibility (the app would just fall back to crt.sh forever without a
// trace). This is exactly the shape-drift failure mode the other two apps'
// `normalizeResult()` retirement addresses, applied here to Cert Watch's own
// highest-value endpoint. Historical precedent: the `validTo` date-format bug
// (Node TLS format vs Hermes ISO 8601) was a real shipped bug on 1.0.4, found
// by a user, not caught by the type system.
//
// Field names verified against a live production call (2026-07-12,
// securl-app-production.up.railway.app, GET /api/certificates/live?url=
// https://example.com).
import { z } from 'zod';

function logShapeDrift(context: string, detail: unknown): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[schemas] ${context} did not match the expected shape`, detail);
  }
}

const RawLiveCertificateSchema = z
  .object({
    available: z.boolean().optional(),
    issuer: z.string().optional(),
    validTo: z.string().optional(),
    daysRemaining: z.number().optional(),
    serialNumber: z.string().optional(),
  })
  .passthrough();

const RawLiveCertResponseSchema = z
  .object({
    certificate: RawLiveCertificateSchema.optional(),
  })
  .passthrough();

export interface ParsedLiveCertificate {
  serialNumber: string;
  validTo: string;
  daysRemaining: number;
  issuer?: string;
}

/**
 * Validate the `GET /api/certificates/live` response at the boundary. Returns
 * null when the shape doesn't carry a usable cert (missing/unavailable/
 * malformed) — same fail-safe contract as before (caller falls back to
 * crt.sh) — but now logs in dev so a backend field rename shows up
 * immediately instead of silently degrading to "always falls back".
 */
// ── Monitoring health (GET /api/monitoring-health) ─────────────────────────
// Owner-agnostic operational health of the server-side monitoring pipeline —
// consumed by the home screen's confidence caption ("is monitoring working").
// We validate only the fields that caption reads; everything else passes
// through untouched. Field names verified against a live production capture
// (2026-07-13, securl-app-production.up.railway.app).
const RawMonitoringHealthSchema = z
  .object({
    summary: z
      .object({
        pushDevicesNeedingRegistration: z.number().optional(),
      })
      .passthrough()
      .optional(),
    scheduler: z
      .object({
        enabled: z.boolean().optional(),
        lastSweepHealthy: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    notifications: z
      .object({
        enabled: z.boolean().optional(),
        credentialsConfigured: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export interface ParsedMonitoringHealth {
  schedulerEnabled: boolean;
  lastSweepHealthy: boolean;
  notificationsEnabled: boolean;
  notificationCredentialsConfigured: boolean;
  pushDevicesNeedingRegistration: number;
}

/**
 * Validate the `GET /api/monitoring-health` response at the boundary. Returns
 * null when the payload doesn't match (caller renders nothing — this is a
 * confidence hint, never a blocker). Missing individual fields default to the
 * healthy value so an additive backend change can't paint a false "degraded".
 */
export function parseMonitoringHealth(raw: unknown): ParsedMonitoringHealth | null {
  const parsed = RawMonitoringHealthSchema.safeParse(raw);
  if (!parsed.success) {
    logShapeDrift('monitoring-health', parsed.error.issues);
    return null;
  }
  const { summary, scheduler, notifications } = parsed.data;
  return {
    schedulerEnabled: scheduler?.enabled !== false,
    lastSweepHealthy: scheduler?.lastSweepHealthy !== false,
    notificationsEnabled: notifications?.enabled !== false,
    notificationCredentialsConfigured: notifications?.credentialsConfigured !== false,
    pushDevicesNeedingRegistration:
      typeof summary?.pushDevicesNeedingRegistration === 'number' &&
      summary.pushDevicesNeedingRegistration > 0
        ? summary.pushDevicesNeedingRegistration
        : 0,
  };
}

export function parseLiveCertResponse(raw: unknown): ParsedLiveCertificate | null {
  const parsed = RawLiveCertResponseSchema.safeParse(raw);
  if (!parsed.success) {
    logShapeDrift('certificates/live', parsed.error.issues);
    return null;
  }
  const c = parsed.data.certificate;
  if (!c || c.available === false) return null; // legitimate "no live cert" — not shape drift
  if (!c.serialNumber || !c.validTo || c.daysRemaining == null) {
    // available (or unstated) but missing fields we need — this is the drift
    // signal: the backend responded but not with the shape we expect.
    logShapeDrift('certificates/live certificate (missing required fields)', c);
    return null;
  }
  return {
    serialNumber: c.serialNumber,
    validTo: c.validTo,
    daysRemaining: c.daysRemaining,
    issuer: c.issuer,
  };
}
