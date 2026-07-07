/**
 * First-run onboarding gate. `seen` is null while loading, then true/false.
 * On any storage error we default to "seen" so onboarding can't wedge the app.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cw_onboarding_seen_v1';

export function useOnboarding() {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setSeen(v === '1'))
      .catch(() => setSeen(true));
  }, []);

  const dismiss = useCallback(async () => {
    setSeen(true);
    await AsyncStorage.setItem(KEY, '1').catch(() => {});
  }, []);

  return { seen, dismiss };
}
