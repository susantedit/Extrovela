/**
 * EXTROVELA — Preference Learning & Feedback Signal System
 * 
 * Implements bounded preference weight adjustments based on user completions,
 * mood ratings, and rejection feedback signals without overwriting explicit preferences.
 */

import { QuestRejectionSignal } from '../types';
import { UserPreferences } from '../../types/user';
import logger from '../../utils/logger';

export class LearningSystem {
  static recordRejectionSignal(signal: QuestRejectionSignal): void {
    logger.info('Recorded quest rejection signal', { reason: signal.reason, questId: signal.questId });
    const key = 'extrovela_rejection_history';
    const history = JSON.parse(localStorage.getItem(key) || '[]');
    history.push(signal);
    localStorage.setItem(key, JSON.stringify(history));
  }

  static applyFeedbackToPreferences(currentPrefs: UserPreferences, category: string, rating: number): UserPreferences {
    logger.info('Updating learned preference signal', { category, rating });
    const interests = currentPrefs.interests || [];
    if (rating >= 4 && !interests.includes(category)) {
      return {
        ...currentPrefs,
        interests: [...interests, category],
      };
    }
    return currentPrefs;
  }
}
