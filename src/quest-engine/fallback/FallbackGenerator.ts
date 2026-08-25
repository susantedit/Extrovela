/**
 * EXTROVELA — Fallback Quest Generator
 * 
 * Rule-based fallback generator that guarantees the user always receives a personalized
 * experience invitation even if third-party AI APIs fail, timeout, or rate-limit.
 */

import { EngineContext, QuestCandidate } from '../types';
import { SEED_QUEST_TEMPLATES } from '../candidates/CandidateGenerator';

export class FallbackQuestGenerator {
  static generateFallback(context: EngineContext): QuestCandidate {
    const isOutdoor = context.currentRequest.environmentPreference === 'outdoor' ||
      (context.preferences.environmentPreference && context.preferences.environmentPreference.toLowerCase().includes('outdoor'));

    const matching = SEED_QUEST_TEMPLATES.find(
      t => (isOutdoor ? t.environment === 'Outdoor' : t.environment === 'Indoor')
    ) || SEED_QUEST_TEMPLATES[0];

    return {
      ...matching,
      id: `fallback_${Date.now()}`,
      whyThisQuest: 'Curated to match your preferred environment and rhythm today.',
    };
  }
}
