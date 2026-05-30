import { useState, useCallback } from 'react';
import { loadWatches, addWatch, updateWatch, removeWatch } from '../storage/watches';
import { removeEventsForWatch } from '../storage/events';
import type { CertWatch } from '../types';

export function useWatches() {
  const [watches, setWatches] = useState<CertWatch[]>([]);

  const load = useCallback(async () => {
    const data = await loadWatches();
    setWatches(data);
  }, []);

  const add = useCallback(async (watch: CertWatch) => {
    await addWatch(watch);
    await load();
  }, [load]);

  const update = useCallback(async (watch: CertWatch) => {
    await updateWatch(watch);
    await load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
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
