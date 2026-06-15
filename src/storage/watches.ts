import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CertWatch } from '../types';

const STORAGE_NAMESPACE = 'cw:watches_v1';

export async function loadWatches(): Promise<CertWatch[]> {
  const raw = await AsyncStorage.getItem(STORAGE_NAMESPACE);
  return raw ? JSON.parse(raw) : [];
}

export async function saveWatches(watches: CertWatch[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_NAMESPACE, JSON.stringify(watches));
}

export async function addWatch(watch: CertWatch): Promise<void> {
  const watches = await loadWatches();
  watches.unshift(watch);
  await saveWatches(watches);
}

export async function updateWatch(updated: CertWatch): Promise<void> {
  const watches = await loadWatches();
  const idx = watches.findIndex((w) => w.id === updated.id);
  if (idx !== -1) watches[idx] = updated;
  await saveWatches(watches);
}

export async function removeWatch(id: string): Promise<void> {
  const watches = await loadWatches();
  await saveWatches(watches.filter((w) => w.id !== id));
}
