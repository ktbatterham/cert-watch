import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CertEvent } from '../types';
import { createLock } from './lock';

const STORAGE_NAMESPACE = 'cw:events_v1';
const withLock = createLock();

export async function loadEvents(): Promise<CertEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_NAMESPACE);
    return raw ? (JSON.parse(raw) as CertEvent[]) : [];
  } catch {
    return [];
  }
}

export async function saveEvents(events: CertEvent[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_NAMESPACE, JSON.stringify(events));
}

export function addEvent(event: CertEvent): Promise<void> {
  return withLock(async () => {
    const events = await loadEvents();
    await saveEvents([event, ...events]);
  });
}

export async function getEventsForWatch(watchId: string): Promise<CertEvent[]> {
  const events = await loadEvents();
  return events.filter((e) => e.watchId === watchId);
}

export function removeEventsForWatch(watchId: string): Promise<void> {
  return withLock(async () => {
    const events = await loadEvents();
    await saveEvents(events.filter((e) => e.watchId !== watchId));
  });
}
