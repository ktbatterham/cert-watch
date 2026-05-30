import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { loadWatches } from '../storage/watches';
import { checkCert, isDue } from './checkCert';
import { scheduleCertNotification } from '../notifications';

export const BACKGROUND_FETCH_TASK = 'cw-cert-check';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const watches = await loadWatches();
    const due = watches.filter(isDue);
    for (const watch of due) {
      const event = await checkCert(watch);
      if (event) await scheduleCertNotification(event);
    }
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundFetch(): Promise<void> {
  const status = await BackgroundFetch.getStatusAsync();
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
    status === BackgroundFetch.BackgroundFetchStatus.Denied
  ) {
    return;
  }
  await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
    minimumInterval: 60 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
