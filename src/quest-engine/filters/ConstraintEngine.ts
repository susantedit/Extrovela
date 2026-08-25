/**
 * EXTROVELA — Quest Engine Constraint Engine (Phase 6)
 * 
 * Enforces hard boundary checks:
 * - Available time window
 * - Budget ceilings
 * - Environment matching
 * - Explicit dislikes
 * - Weather safety rules (heavy rain/storm restricts exposed outdoor quests)
 */

import { EngineContext, QuestCandidate, ConstraintValidationResult } from '../types';

export class ConstraintEngine {
  static parseMinutes(timeStr?: string): number {
    if (!timeStr) return 30;
    const match = timeStr.match(/\d+/);
    if (!match) return 30;
    const num = parseInt(match[0], 10);
    if (timeStr.toLowerCase().includes('hour')) return num * 60;
    return num;
  }

  static validate(candidate: QuestCandidate, context: EngineContext): ConstraintValidationResult {
    const reasons: string[] = [];

    // 1. Hard Time Constraint Check
    const maxAvailableMinutes = context.currentRequest.availableTimeMinutes || this.parseMinutes(context.preferences.typicalAvailableTime);
    const candidateMinutes = this.parseMinutes(candidate.time);

    if (candidateMinutes > maxAvailableMinutes) {
      reasons.push(`duration_exceeded_${candidateMinutes}m_vs_max_${maxAvailableMinutes}m`);
    }

    // 2. Hard Weather Safety Check (Phase 6)
    if (context.weather && !context.weather.isSafeForExposedOutdoor) {
      if (candidate.environment === 'Outdoor' && candidate.difficulty !== 'Comfort') {
        reasons.push('weather_safety_hazard_severe_conditions');
      }
    }

    // 3. Hard Environment Constraint Check
    if (context.currentRequest.environmentPreference) {
      const reqEnv = context.currentRequest.environmentPreference.toLowerCase();
      if (reqEnv === 'indoor' && candidate.environment.toLowerCase() !== 'indoor') {
        reasons.push('environment_mismatch_requires_indoor');
      } else if (reqEnv === 'outdoor' && candidate.environment.toLowerCase() !== 'outdoor') {
        reasons.push('environment_mismatch_requires_outdoor');
      }
    }

    // 4. Hard Dislikes Filter
    const userDislikes = context.preferences.dislikes || [];
    for (const dislike of userDislikes) {
      const lower = dislike.toLowerCase();
      if (lower.includes('crowd') && candidate.category.toLowerCase().includes('social') && candidate.social === 'Group adventure') {
        reasons.push('dislike_crowds_violation');
      }
      if (lower.includes('expensive') && candidate.budget === 'Treat Myself ($$$)') {
        reasons.push('dislike_expensive_violation');
      }
    }

    // 5. Hard Budget Check
    if (context.currentRequest.budgetMaxNpr !== undefined && context.currentRequest.budgetMaxNpr === 0) {
      if (candidate.budget !== 'Free') {
        reasons.push('budget_exceeded_must_be_free');
      }
    }

    // 6. Opening-hours guard (Phase 13). DORMANT: only fires for a candidate that
    //    has been explicitly bound to a real place we can see is closed right now.
    //    No candidate generator sets boundPlace yet, so this is a no-op today; it
    //    activates with the deferred place-bound-candidate pass. We reject only on
    //    a confirmed 'closed' — 'unknown'/'open'/absent never block a quest.
    if (candidate.boundPlace?.openingStatus === 'closed') {
      reasons.push('bound_place_closed');
    }

    return {
      valid: reasons.length === 0,
      reasons,
    };
  }
}
