import { useState, useCallback } from 'react';
import { loadWatches, addWatch, updateWatch, removeWatch } from '../storage/watches';
import { removeEventsForWatch } from '../storage/events';
import { createCertMonitoringTarget, deleteMonitoringTarget } from '../api/client';
import type { CertWatch } from '../types';

export function useWatches() {
  const [watches, setWatches] = useState<CertWatch[]>([]);

  const load = useCallback(async () => {
    let data = await loadWatches();
    setWatches(data);
    // Backfill server monitoring for watches added before it existed (best-effort,
    // once each — undefined means never attempted).
    const missing = data.filter((w) => w.serverTargetId === undefined);
    if (missing.length > 0) {
      for (const w of missing) {
        const serverTargetId = await createCertMonitoringTarget(w.domain);
        await updateWatch({ ...w, serverTargetId: serverTargetId ?? null });
      }
      data = await loadWatches();
      setWatches(data);
    }
  }, []);

  const add = useCallback(async (watch: CertWatch) => {
    await addWatch(watch);
    // Register server-side cert monitoring so the backend checks daily + pushes
    // events even when the app is closed. Best-effort — the local checker still runs.
    const serverTargetId = await createCertMonitoringTarget(watch.domain);
    await updateWatch({ ...watch, serverTargetId: serverTargetId ?? null });
    await load();
  }, [load]);

  const update = useCallback(async (watch: CertWatch) => {
    await updateWatch(watch);
    await load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    const existing = (await loadWatches()).find((w) => w.id === id);
    if (existing?.serverTargetId) await deleteMonitoringTarget(existing.serverTargetId);
    await removeWatch(id);
    await removeEventsForWatch(id);
    await load();
  }, [load]);

  const clearAlert = useCallback(async (id: string) => {
    const watches = await loadWatches();
    const watch = watches.find((w) => w.id === id);
    if (watch?.hasAlert) {
      await updateWatch({ ...watch, hasAlert: false });
    }
  }, []);

  return { watches, load, add, update, remove, clearAlert };
}
