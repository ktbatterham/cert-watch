/**
 * Thin wrapper over expo-haptics so call sites stay terse and any failure (e.g.
 * a device without a Taptic Engine, or Expo Go) is swallowed rather than thrown.
 */
import * as Haptics from 'expo-haptics';

export const haptics = {
  /** A light tap — for routine taps like opening a row or kicking off a check. */
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  /** A medium tap — for committing an action like adding a watch. */
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  /** Success cue — a completed, positive action. */
  success: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  /** Warning cue — something needs attention (e.g. a cert event). */
  warning: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  /** Error cue — an action failed. */
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
