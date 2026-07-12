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
