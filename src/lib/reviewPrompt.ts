/**
 * Privacy-safe App Store / Play Store ratings prompt.
 *
 * Called after a genuine positive moment (successfully adding a cert watch).
 * It NEVER throws, NEVER blocks, and sends NO data anywhere: the only state is
 * two small AsyncStorage keys used to make the prompt feel earned and rare.
 *
 * Gates (belt-and-suspenders on top of iOS's own requestReview throttling):
 *   1. Only ever prompt once per app version.
 *   2. Only prompt from the SECOND positive moment onward, so brand-new users
 *      are never asked instantly.
 *   3. Only prompt when the native store-review flow is actually available.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';

const COUNTER_KEY = 'review:positiveMoments';
const PROMPTED_VERSION_KEY = 'review:promptedVersion';

// Wait for at least this many positive moments before ever prompting.
const MIN_POSITIVE_MOMENTS = 2;

export async function maybePromptForReview(): Promise<void> {
  try {
    const currentVersion = Constants.expoConfig?.version;
    // Without a version string we can't honour the once-per-version gate, so
    // stay silent rather than risk nagging on every positive moment.
    if (!currentVersion) return;

    // Only ask once per released version.
    const promptedVersion = await AsyncStorage.getItem(PROMPTED_VERSION_KEY);
    if (promptedVersion === currentVersion) return;

    // Count this positive moment and persist immediately.
    const priorRaw = await AsyncStorage.getItem(COUNTER_KEY);
    const prior = Number.parseInt(priorRaw ?? '', 10);
    const count = (Number.isFinite(prior) ? prior : 0) + 1;
    await AsyncStorage.setItem(COUNTER_KEY, String(count));

    // Hold off until the second positive moment.
    if (count < MIN_POSITIVE_MOMENTS) return;

    // Native availability gate (belt-and-suspenders alongside iOS throttling).
    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;

    await StoreReview.requestReview();

    // Record that this version has now shown the prompt.
    await AsyncStorage.setItem(PROMPTED_VERSION_KEY, currentVersion);
  } catch {
    // Ratings are strictly best-effort: swallow everything, never surface.
  }
}
