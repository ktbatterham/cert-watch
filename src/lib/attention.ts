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
 * TEMPORARY: this client-side derivation stands in for backend request #7
 * (`monitoring-attention-v1` rollup). When that ships, the server returns the
 * ordered/attention rollup directly and this module becomes a thin adapter —
 * keep ALL derivation logic in this file so the swap stays single-file.
 */
import type { ServerTargetStatus } from '../api/client';
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
