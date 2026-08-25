/**
 * EXTROVELA — Phase 11: Diversity Engine
 *
 * Stops the personalization loop from collapsing into a monoculture. Three jobs:
 *   1. RECENT-CATEGORY PENALTY — suppress categories seen very recently
 *   2. REPETITION DETECTION    — flag when the user is stuck in a loop
 *   3. EXPERIENCE GAP DETECTION — surface things they liked but stopped doing
 *
 * Diversity is applied AFTER safety, hard constraints, feasibility and
 * preferences, and BEFORE presentation — see quest generation priority order.
 */

import logger from '../../utils/logger';
import { intelligenceFirestore } from './intelligenceFirestore';
import { experienceGraphService } from './experienceGraphService';
import { userExperienceProfileService } from './userExperienceProfileService';
import type {
  ExperienceEvent,
  ExperienceGapSummary,
  UserExperienceProfile,
} from '../../types/experienceIntelligence';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DiversityConfig {
  /** Days over which the recency penalty applies. */
  recentWindowDays: number;
  /** Penalty for a category seen today, decaying linearly across the window. */
  maxRecentPenalty: number;
  /** Extra penalty when the same category dominates the recent window. */
  monoculturePenalty: number;
  /** Occurrences of one category within the window that count as a rut. */
  repetitionThreshold: number;
}

export const DEFAULT_DIVERSITY_CONFIG: DiversityConfig = {
  recentWindowDays: 14,
  maxRecentPenalty: 0.35,
  monoculturePenalty: 0.2,
  repetitionThreshold: 3,
};

export interface RepetitionReport {
  isRepetitive: boolean;
  dominantCategory: string | null;
  /** Share of recent events belonging to the dominant category, [0,1]. */
  dominanceRatio: number;
  occurrences: number;
  windowDays: number;
}

/**
 * Recency penalty in [0, maxRecentPenalty] for one candidate category.
 * Pure so it can be unit-tested without I/O.
 */
export function recentCategoryPenalty(
  candidateCategory: string | undefined,
  recentEvents: ExperienceEvent[],
  now: Date,
  config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG
): number {
  if (!candidateCategory) return 0;
  const target = candidateCategory.toLowerCase();

  let penalty = 0;
  for (const event of recentEvents) {
    if ((event.category || '').toLowerCase() !== target) continue;
    const ageDays = (now.getTime() - new Date(event.createdAt).getTime()) / DAY_MS;
    if (ageDays > config.recentWindowDays) continue;
    // Linear decay: today = full penalty, end of window = none.
    const decayed = config.maxRecentPenalty * (1 - ageDays / config.recentWindowDays);
    penalty = Math.max(penalty, decayed);
  }

  return Number(penalty.toFixed(4));
}

export function detectRepetitionFromEvents(
  events: ExperienceEvent[],
  now: Date,
  config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG
): RepetitionReport {
  const cutoff = now.getTime() - config.recentWindowDays * DAY_MS;
  const recent = events.filter(
    e => new Date(e.createdAt).getTime() >= cutoff && e.category
  );

  if (recent.length === 0) {
    return {
      isRepetitive: false,
      dominantCategory: null,
      dominanceRatio: 0,
      occurrences: 0,
      windowDays: config.recentWindowDays,
    };
  }

  const counts = new Map<string, number>();
  for (const event of recent) {
    const key = (event.category as string).toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const [dominantCategory, occurrences] = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const dominanceRatio = Number((occurrences / recent.length).toFixed(3));

  return {
    isRepetitive: occurrences >= config.repetitionThreshold && dominanceRatio >= 0.6,
    dominantCategory,
    dominanceRatio,
    occurrences,
    windowDays: config.recentWindowDays,
  };
}

/** Full diversity adjustment for a candidate: negative numbers are penalties. */
export function diversityAdjustment(
  candidate: { category?: string; tags?: string[] },
  context: {
    recentEvents: ExperienceEvent[];
    repetition: RepetitionReport;
    now: Date;
    config?: DiversityConfig;
  }
): { adjustment: number; reasons: string[] } {
  const config = context.config || DEFAULT_DIVERSITY_CONFIG;
  const reasons: string[] = [];
  let adjustment = 0;

  const recency = recentCategoryPenalty(candidate.category, context.recentEvents, context.now, config);
  if (recency > 0) {
    adjustment -= recency;
    reasons.push('recent_category_penalty');
  }

  const candidateCategory = (candidate.category || '').toLowerCase();
  if (
    context.repetition.isRepetitive &&
    context.repetition.dominantCategory === candidateCategory
  ) {
    adjustment -= config.monoculturePenalty;
    reasons.push('monoculture_penalty');
  }

  // Reward breaking a rut.
  if (
    context.repetition.isRepetitive &&
    candidateCategory &&
    context.repetition.dominantCategory !== candidateCategory
  ) {
    adjustment += config.monoculturePenalty * 0.5;
    reasons.push('rut_breaking_boost');
  }

  return { adjustment: Number(adjustment.toFixed(4)), reasons };
}

export class DiversityEngine {
  /** Loads the recent-event context needed to score diversity for a user. */
  async loadContext(
    userId: string,
    config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG
  ): Promise<{
    recentEvents: ExperienceEvent[];
    repetition: RepetitionReport;
    profile: UserExperienceProfile | null;
    now: Date;
  }> {
    const now = new Date();
    const [events, profile] = await Promise.all([
      intelligenceFirestore.getEvents(userId, 200),
      userExperienceProfileService.getProfile(userId),
    ]);

    const cutoff = now.getTime() - config.recentWindowDays * DAY_MS;
    const recentEvents = events.filter(e => new Date(e.createdAt).getTime() >= cutoff);
    const repetition = detectRepetitionFromEvents(events, now, config);

    if (repetition.isRepetitive) {
      logger.debug('Repetition detected for user', {
        dominanceRatio: repetition.dominanceRatio,
        occurrences: repetition.occurrences,
      });
    }

    return { recentEvents, repetition, profile, now };
  }

  /** Experience gaps: liked things that have gone quiet, plus never-tried ones. */
  async getGaps(userId: string): Promise<ExperienceGapSummary[]> {
    const profile = await userExperienceProfileService.getProfile(userId);
    if (profile) return profile.gaps;

    // No profile yet — derive gaps from the graph's unexplored adjacency.
    const adjacent = await experienceGraphService.getAdjacentUnexplored(userId, 6);
    return adjacent.map(node => ({
      dimension: node.type === 'category' ? 'category' : 'experienceType',
      value: node.key,
      daysSinceLastEngagement: null,
      reason: 'neverTried' as const,
    }));
  }
}

export const diversityEngine = new DiversityEngine();
export default diversityEngine;
