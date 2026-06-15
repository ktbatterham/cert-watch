import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CertEvent } from '../types';

const STORAGE_NAMESPACE = 'cw:events_v1';

export async function loadEvents(): Promise<CertEvent[]> {
  const raw = await AsyncStorage.getItem(STORAGE_NAMESPACE);
  return raw ? JSON.parse(raw) : [];
}

export async function saveEvents(events: CertEvent[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_NAMESPACE, JSON.stringify(events));
}

export async function addEvent(event: CertEvent): Promise<void> {
  const events = await loadEvents();
  events.unshift(event);
  await saveEvents(events);
}

export async function getEventsForWatch(watchId: string): Promise<CertEvent[]> {
  const events = await loadEvents();
  return events.filter((e) => e.watchId === watchId);
}

export async function removeEventsForWatch(watchId: string): Promise<void> {
  const events = await loadEvents();
  await saveEvents(events.filter((e) => e.watchId !== watchId));
}
