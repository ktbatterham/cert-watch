/**
 * Attention-first home derivation for the watch list.
 *
 * Given the local watches plus the server-authored per-target status from
 * /api/monitoring-cert-summary (keyed by LOCAL watch id, see useWatches), this
 * classifies each watch as ok / attention / critical and returns the list
 * reordered so the urgent rows come first: critical (expired or
 * server-severity critical), then attention, each ordered by fewest days
 * remaining, then everything else in its existing order (stable).
 *
 * The backend `monitoring-attention-v1` rollup is now LIVE: when the capability
 * is advertised, the home screen prefers `attentionFromServer()` below, which
 * maps the server's authoritative rollup into the SAME shape `deriveAttention()`
 * returns. `deriveAttention()` (with its local-expiry fallback) remains the
 * FALLBACK path whenever the flag is absent or the fetch fails — behaviour then
 * is byte-identical to before the server path existed. Both mappings live in
 * this one file so the screen consumes a single interface.
 */
import type { ServerTargetStatus } from '../api/client';
import type { ParsedAttention } from '../api/schemas';
import type { CertWatch } from '../types';

export type AttentionState = 'ok' | 'attention' | 'critical';

export interface AttentionCounts {
  ok: number;
  attention: number;
  critical: number;
}

export interface AttentionSummary {
  state: AttentionState;
  counts: AttentionCounts;
  orderedWatches: CertWatch[];
}

// Local fallback band when the server summary is absent for a watch: matches
// the tightest server warn window (`production` policy warns from 14 days out).
const LOCAL_ATTENTION_DAYS = 14;

// Classify one watch. Server-computed attention wins when present; otherwise
// fall back to the locally-known expiry (Cert Watch keeps local cert state).
// No server status AND no local expiry data → ok (absence is not attention).
function classifyWatch(
  watch: CertWatch,
  serverStatus: ServerTargetStatus | undefined,
): AttentionState {
  const days = watch.daysUntilExpiry;
  const expired = days !== null && days <= 0;
  if (serverStatus?.state != null) {
    if (serverStatus.state !== 'needs_attention') return 'ok';
    return serverStatus.severity === 'critical' || expired ? 'critical' : 'attention';
  }
  if (days === null) return 'ok';
  if (expired) return 'critical';
  return days <= LOCAL_ATTENTION_DAYS ? 'attention' : 'ok';
}

const STATE_RANK: Record<AttentionState, number> = { critical: 0, attention: 1, ok: 2 };

/**
 * Pure derivation: attention-first ordering + counts for the home screen.
 * Within critical/attention, fewest days remaining first (unknown expiry
 * last); ties and all ok rows keep their existing order (stable).
 */
export function deriveAttention(
  watches: CertWatch[],
  serverStatus: Map<string, ServerTargetStatus>,
): AttentionSummary {
  const counts: AttentionCounts = { ok: 0, attention: 0, critical: 0 };
  const rows = watches.map((watch, index) => {
    const state = classifyWatch(watch, serverStatus.get(watch.id));
    counts[state] += 1;
    return { watch, state, index };
  });

  const orderedWatches = rows
    .sort((a, b) => {
      const byState = STATE_RANK[a.state] - STATE_RANK[b.state];
      if (byState !== 0) return byState;
      if (a.state !== 'ok') {
        const aDays = a.watch.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
        const bDays = b.watch.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
        if (aDays !== bDays) return aDays - bDays;
      }
      return a.index - b.index; // stable within equal urgency
    })
    .map((r) => r.watch);

  const state: AttentionState =
    counts.critical > 0 ? 'critical' : counts.attention > 0 ? 'attention' : 'ok';
  return { state, counts, orderedWatches };
}

/**
 * Maps the server-authored `monitoring-attention-v1` rollup into the same
 * AttentionSummary shape as deriveAttention(). Rows arrive already
 * attention-ordered; each is matched back to a local watch by serverTargetId,
 * then domain, preserving server order for matched watches and appending the
 * rest in their existing order. Counts come from matched rows so the bar always
 * describes the visible list (a watch flagged only on another device can't
 * inflate a count with no row to point at).
 */
export function attentionFromServer(
  server: ParsedAttention,
  watches: CertWatch[],
): AttentionSummary {
  const byServerId = new Map<string, CertWatch>();
  const byHost = new Map<string, CertWatch>();
  watches.forEach((w) => {
    if (w.serverTargetId) byServerId.set(w.serverTargetId, w);
    if (w.domain) byHost.set(w.domain.toLowerCase(), w);
  });

  const matched: CertWatch[] = [];
  const seen = new Set<string>();
  const counts: AttentionCounts = { ok: 0, attention: 0, critical: 0 };

  server.attention.forEach((row) => {
    const watch =
      (row.targetId ? byServerId.get(row.targetId) : undefined) ??
      (row.host ? byHost.get(row.host.toLowerCase()) : undefined);
    if (!watch || seen.has(watch.id)) return;
    seen.add(watch.id);
    matched.push(watch);
    if (row.severity === 'critical') counts.critical += 1;
    else counts.attention += 1;
  });

  const rest = watches.filter((w) => !seen.has(w.id));
  counts.ok = rest.length;
  const state: AttentionState =
    counts.critical > 0 ? 'critical' : counts.attention > 0 ? 'attention' : 'ok';
  return { state, counts, orderedWatches: [...matched, ...rest] };
}
