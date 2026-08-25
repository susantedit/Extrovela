/**
 * EXTROVELA — Haptic Feedback Wrapper
 */

import { triggerHaptic } from '../lib/native-device';

export const haptics = {
  light: () => triggerHaptic('light'),
  medium: () => triggerHaptic('medium'),
  success: () => triggerHaptic('success'),
  warning: () => triggerHaptic('warning'),
  selection: () => triggerHaptic('light'),
};

export default haptics;
