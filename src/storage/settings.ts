/**
 * App-level Cert Watch preferences. Small, defensive, AsyncStorage-backed.
 * v1: the default check cadence applied to newly-added watches (each watch can
 * still be overridden on its detail screen).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cw_settings_v1';

export type CadenceHours = 1 | 6 | 24;

export interface CertWatchSettings {
  defaultCadenceHours: CadenceHours;
}

const DEFAULTS: CertWatchSettings = { defaultCadenceHours: 24 };

function coerceCadence(v: unknown): CadenceHours {
  return v === 1 || v === 6 || v === 24 ? v : DEFAULTS.defaultCadenceHours;
}

export async function loadSettings(): Promise<CertWatchSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<CertWatchSettings>;
    return { defaultCadenceHours: coerceCadence(parsed.defaultCadenceHours) };
  } catch {
    return DEFAULTS;
  }
}

export async function saveSettings(settings: CertWatchSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // best-effort — a failed write just means the default persists
  }
}
