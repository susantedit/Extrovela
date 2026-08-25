/**
 * EXTROVELA — Phase 11: Novelty Engine
 *
 * Decides how far outside a user's comfort zone the next suggestion should sit.
 * Default balance is ~80% comfortable / 20% stretch, tunable per user via
 * PersonalizationSettings.noveltyPreference and informed by the profile's
 * behaviourally-derived noveltyAppetite.
 *
 * Target novelty scores are configurable, defaulting to:
 *   comfortable 0.2 · stretch 0.5 · surprise 0.8
 */

import logger from '../../utils/logger';
import { personalizationSettingsService } from './personalizationSettingsService';
import { userExperienceProfileService } from './userExperienceProfileService';
import {
  NOVELTY_TARGET_SCORES,
  type NoveltyDecision,
  type NoveltyLevel,
  type UserExperienceProfile,
} from '../../types/experienceIntelligence';

export interface NoveltyConfig {
  /** Probability of a stretch suggestion when appetite is at its default. */
  baseStretchRate: number;
  /** Probability of a full surprise, only when the user allows it. */
  baseSurpriseRate: number;
  targetScores: Record<NoveltyLevel, number>;
}

export const DEFAULT_NOVELTY_CONFIG: NoveltyConfig = {
  baseStretchRate: 0.2,
  baseSurpriseRate: 0.05,
  targetScores: { ...NOVELTY_TARGET_SCORES },
};

/**
 * Deterministic level chooser. `roll` is supplied by the caller (Math.random in
 * production, a fixed value in tests) so novelty distribution is testable.
 */
export function chooseNoveltyLevel(
  roll: number,
  options: {
    noveltyPreference: number;
    noveltyAppetite: number;
    surpriseAllowed: boolean;
    profileConfidence: number;
    config?: NoveltyConfig;
  }
): NoveltyDecision {
  const config = options.config || DEFAULT_NOVELTY_CONFIG;

  // With almost no evidence, "comfortable" is meaningless — we don't know their
  // comfort zone yet, so stay neutral rather than pretending to personalize.
  if (options.profileConfidence < 0.2) {
    return {
      level: 'comfortable',
      targetScore: config.targetScores.comfortable,
      reason: 'insufficient_profile_confidence',
    };
  }

  // Blend the user's explicit dial with their observed appetite (dial dominates).
  const effective = Math.min(
    0.75,
    Math.max(0, options.noveltyPreference * 0.7 + options.noveltyAppetite * 0.3)
  );

  const surpriseRate = options.surpriseAllowed
    ? config.baseSurpriseRate * (effective / DEFAULT_NOVELTY_CONFIG.baseStretchRate)
    : 0;
  const stretchRate = Math.max(0, effective - surpriseRate);

  if (roll < surpriseRate) {
    return {
      level: 'surprise',
      targetScore: config.targetScores.surprise,
      reason: 'scheduled_surprise',
    };
  }
  if (roll < surpriseRate + stretchRate) {
    return { level: 'stretch', targetScore: config.targetScores.stretch, reason: 'scheduled_stretch' };
  }
  return {
    level: 'comfortable',
    targetScore: config.targetScores.comfortable,
    reason: 'comfort_default',
  };
}

/**
 * Novelty score of a candidate for this user, in [0,1].
 * 0 = they do this constantly; 1 = entirely new to them.
 */
export function scoreCandidateNovelty(
  candidate: { category?: string; tags?: string[]; experienceType?: string },
  profile: UserExperienceProfile | null
): number {
  if (!profile) return 0.5; // unknown user → neutral

  const known = new Set<string>();
  for (const dimension of profile.dimensions) {
    for (const entry of dimension.topValues) known.add(entry.value);
    for (const entry of dimension.avoidedValues) known.add(entry.value);
  }
  for (const category of profile.recentCategories) known.add(category);

  const terms = [
    candidate.category,
    candidate.experienceType,
    ...(candidate.tags || []),
  ]
    .filter((t): t is string => Boolean(t))
    .map(t => t.toLowerCase());

  if (terms.length === 0) return 0.5;

  const familiar = terms.filter(t => known.has(t)).length;
  return Number((1 - familiar / terms.length).toFixed(3));
}

/** How well a candidate matches the chosen novelty target. Higher is better. */
export function noveltyFitScore(candidateNovelty: number, targetScore: number): number {
  return Number((1 - Math.abs(candidateNovelty - targetScore)).toFixed(3));
}

export class NoveltyEngine {
  /**
   * Resolves the novelty level for a user's next suggestion.
   * `roll` is injectable for deterministic tests.
   */
  async decide(userId: string, roll: number = Math.random()): Promise<NoveltyDecision> {
    const [settings, profile] = await Promise.all([
      personalizationSettingsService.getSettings(userId),
      userExperienceProfileService.getProfile(userId),
    ]);

    if (!settings.aiPersonalizationEnabled) {
      return {
        level: 'comfortable',
        targetScore: DEFAULT_NOVELTY_CONFIG.targetScores.comfortable,
        reason: 'personalization_disabled',
      };
    }

    const decision = chooseNoveltyLevel(roll, {
      noveltyPreference: settings.noveltyPreference,
      noveltyAppetite: profile?.noveltyAppetite ?? 0.2,
      surpriseAllowed: settings.surpriseQuestsEnabled,
      profileConfidence: profile?.overallConfidence ?? 0,
    });

    logger.debug('Novelty level chosen', { level: decision.level, reason: decision.reason });
    return decision;
  }
}

export const noveltyEngine = new NoveltyEngine();
export default noveltyEngine;
