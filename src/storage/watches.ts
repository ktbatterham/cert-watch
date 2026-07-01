import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CertWatch } from '../types';
import { createLock } from './lock';

const STORAGE_NAMESPACE = 'cw:watches_v1';
const withLock = createLock();

export async function loadWatches(): Promise<CertWatch[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_NAMESPACE);
    return raw ? (JSON.parse(raw) as CertWatch[]) : [];
  } catch {
    return [];
  }
}

export async function saveWatches(watches: CertWatch[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_NAMESPACE, JSON.stringify(watches));
}

export function addWatch(watch: CertWatch): Promise<void> {
  return withLock(async () => {
    const watches = await loadWatches();
    await saveWatches([watch, ...watches]);
  });
}

export function updateWatch(updated: CertWatch): Promise<void> {
  return withLock(async () => {
    const watches = await loadWatches();
    await saveWatches(watches.map((w) => (w.id === updated.id ? updated : w)));
  });
}

export function removeWatch(id: string): Promise<void> {
  return withLock(async () => {
    const watches = await loadWatches();
    await saveWatches(watches.filter((w) => w.id !== id));
  });
}
