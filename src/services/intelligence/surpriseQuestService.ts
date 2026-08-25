/**
 * EXTROVELA — Phase 11: Surprise Quest Service
 *
 * Occasionally proposes something deliberately outside the user's established
 * pattern. Important boundaries:
 *
 *  - A surprise is a SEED (a direction to explore), never a finished quest.
 *    Real-world facts — places, hours, weather, events — are still supplied by
 *    the Context Engine downstream. This service invents no place and no time.
 *  - Surprise NEVER overrides safety or hard constraints. It only widens the
 *    preference/novelty band.
 *  - Rate-limited and opt-out-able. Off by default for users who disabled
 *    surpriseQuestsEnabled or AI personalization entirely.
 */

import logger from '../../utils/logger';
import { intelligenceFirestore } from './intelligenceFirestore';
import { personalizationSettingsService } from './personalizationSettingsService';
import { userExperienceProfileService } from './userExperienceProfileService';
import { experienceGraphService } from './experienceGraphService';
import { preferenceSignalService, MIN_USABLE_CONFIDENCE } from './preferenceSignalService';
import { diversityEngine } from './diversityEngine';
import { isSafeDerivedValue } from './sensitiveAttributeGuard';
import type {
  ExperienceGapSummary,
  HardConstraints,
  PreferenceDimension,
} from '../../types/experienceIntelligence';

const DAY_MS = 24 * 60 * 60 * 1000;

/** At most one surprise per this many days, so it stays a surprise. */
export const SURPRISE_COOLDOWN_DAYS = 7;
/** Below this profile confidence we don't know their comfort zone, so nothing is "surprising". */
export const SURPRISE_MIN_PROFILE_CONFIDENCE = 0.3;

export type SurpriseOrigin =
  | 'graphAdjacency'
  | 'experienceGap'
  | 'dormantFavourite'
  | 'underexploredDimension';

export interface SurpriseSeed {
  /** Dimension the surprise stretches, e.g. 'category' or 'socialMode'. */
  dimension: PreferenceDimension;
  /** The value to explore — a real dimension value, never an invented place. */
  value: string;
  origin: SurpriseOrigin;
  /** Target novelty for the generator, always the surprise band. */
  targetNoveltyScore: number;
  /**
   * Short, factual justification safe to show the user.
   * Never emotional, never diagnostic.
   */
  rationale: string;
  /** Lineage: signals/nodes that motivated the seed. */
  sourceIds: string[];
}

export interface SurpriseEligibility {
  eligible: boolean;
  reason: string;
  daysSinceLastSurprise: number | null;
}

export interface SurpriseDecision {
  seed: SurpriseSeed | null;
  eligibility: SurpriseEligibility;
}

/**
 * A surprise may widen preferences but never relaxes a hard constraint.
 * Returns true when the seed can coexist with the user's stated limits.
 */
export function surpriseRespectsConstraints(
  seed: SurpriseSeed,
  constraints: HardConstraints
): boolean {
  const value = seed.value.toLowerCase();

  const excluded = constraints.exclusions.some(
    ex => ex.toLowerCase() === value || value.includes(ex.toLowerCase())
  );
  if (excluded) return false;

  if (constraints.requireIndoor && seed.dimension === 'indoorOutdoor' && value === 'outdoor') {
    return false;
  }

  // Accessibility needs are treated as hard: a surprise must not push a user
  // toward something their stated needs rule out.
  const conflictsWithAccess = constraints.accessibilityNeeds.some(need => {
    const n = need.toLowerCase();
    if (n.includes('wheelchair') || n.includes('mobility')) {
      return ['hike', 'hiking', 'trek', 'trekking', 'climb', 'climbing', 'stairs'].some(t =>
        value.includes(t)
      );
    }
    return false;
  });
  if (conflictsWithAccess) return false;

  return true;
}

/** Picks the strongest seed from the available sources. Pure, so it is testable. */
export function selectSeed(inputs: {
  adjacentUnexplored: Array<{ id: string; type: string; key: string; label: string }>;
  gaps: ExperienceGapSummary[];
  avoidedValues: Set<string>;
}): SurpriseSeed | null {
  // 1. Dormant favourite — something they demonstrably liked but stopped doing.
  //    Highest quality surprise: low risk, high delight.
  const dormant = inputs.gaps.find(
    g => g.reason === 'longAbsence' && !inputs.avoidedValues.has(g.value.toLowerCase())
  );
  if (dormant && isSafeDerivedValue(dormant.value)) {
    return {
      dimension: dormant.dimension,
      value: dormant.value,
      origin: 'dormantFavourite',
      targetNoveltyScore: 0.8,
      rationale:
        dormant.daysSinceLastEngagement !== null
          ? `You haven't done anything in ${dormant.value} for ${dormant.daysSinceLastEngagement} days.`
          : `Revisiting ${dormant.value}.`,
      sourceIds: [],
    };
  }

  // 2. Graph adjacency — connected to what they like, but never tried.
  const adjacent = inputs.adjacentUnexplored.find(
    node => !inputs.avoidedValues.has(node.key.toLowerCase()) && isSafeDerivedValue(node.key)
  );
  if (adjacent) {
    const dimension: PreferenceDimension =
      adjacent.type === 'experienceType'
        ? 'experienceType'
        : adjacent.type === 'socialMode'
          ? 'socialMode'
          : adjacent.type === 'timeOfDay'
            ? 'timeOfDay'
            : adjacent.type === 'setting'
              ? 'setting'
              : 'category';
    return {
      dimension,
      value: adjacent.key,
      origin: 'graphAdjacency',
      targetNoveltyScore: 0.8,
      rationale: `Related to experiences you've enjoyed, but new to you.`,
      sourceIds: [adjacent.id],
    };
  }

  // 3. Never-tried gap.
  const neverTried = inputs.gaps.find(
    g => g.reason === 'neverTried' && !inputs.avoidedValues.has(g.value.toLowerCase())
  );
  if (neverTried && isSafeDerivedValue(neverTried.value)) {
    return {
      dimension: neverTried.dimension,
      value: neverTried.value,
      origin: 'experienceGap',
      targetNoveltyScore: 0.8,
      rationale: `Something you haven't tried yet.`,
      sourceIds: [],
    };
  }

  // 4. Underexplored dimension.
  const underexplored = inputs.gaps.find(
    g => g.reason === 'underexplored' && !inputs.avoidedValues.has(g.value.toLowerCase())
  );
  if (underexplored && isSafeDerivedValue(underexplored.value)) {
    return {
      dimension: underexplored.dimension,
      value: underexplored.value,
      origin: 'underexploredDimension',
      targetNoveltyScore: 0.8,
      rationale: `You've only tried ${underexplored.value} once or twice.`,
      sourceIds: [],
    };
  }

  return null;
}

export class SurpriseQuestService {
  /** Checks opt-in, cooldown and profile maturity. */
  async checkEligibility(userId: string, now = new Date()): Promise<SurpriseEligibility> {
    const settings = await personalizationSettingsService.getSettings(userId);

    if (!settings.aiPersonalizationEnabled) {
      return { eligible: false, reason: 'personalization_disabled', daysSinceLastSurprise: null };
    }
    if (!settings.surpriseQuestsEnabled) {
      return { eligible: false, reason: 'surprise_disabled_by_user', daysSinceLastSurprise: null };
    }

    const profile = await userExperienceProfileService.getProfile(userId);
    if (!profile || profile.overallConfidence < SURPRISE_MIN_PROFILE_CONFIDENCE) {
      return {
        eligible: false,
        reason: 'profile_too_immature_for_surprise',
        daysSinceLastSurprise: null,
      };
    }

    // Cooldown, measured from the last accepted surprise recorded in raw events.
    const events = await intelligenceFirestore.getEvents(userId, 200);
    const lastSurprise = events
      .filter(e => e.reasonCode === 'surprise_accepted')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    if (lastSurprise) {
      const days = (now.getTime() - new Date(lastSurprise.createdAt).getTime()) / DAY_MS;
      if (days < SURPRISE_COOLDOWN_DAYS) {
        return {
          eligible: false,
          reason: 'surprise_cooldown_active',
          daysSinceLastSurprise: Number(days.toFixed(1)),
        };
      }
      return { eligible: true, reason: 'eligible', daysSinceLastSurprise: Number(days.toFixed(1)) };
    }

    return { eligible: true, reason: 'eligible_first_surprise', daysSinceLastSurprise: null };
  }

  /**
   * Produces a surprise seed, or null with a reason. Does not generate a quest —
   * the seed is passed to the generator, which sources real-world facts itself.
   */
  async proposeSurprise(
    userId: string,
    constraints: HardConstraints = { exclusions: [], accessibilityNeeds: [] },
    now = new Date()
  ): Promise<SurpriseDecision> {
    const eligibility = await this.checkEligibility(userId, now);
    if (!eligibility.eligible) {
      return { seed: null, eligibility };
    }

    const [adjacentUnexplored, gaps, signals] = await Promise.all([
      experienceGraphService.getAdjacentUnexplored(userId, 8),
      diversityEngine.getGaps(userId),
      preferenceSignalService.getUsableSignals(userId),
    ]);

    // Never "surprise" a user with something they've clearly rejected.
    const avoidedValues = new Set(
      signals
        .filter(s => s.strength < -0.2 && s.confidence >= MIN_USABLE_CONFIDENCE)
        .map(s => s.value.toLowerCase())
    );

    const seed = selectSeed({ adjacentUnexplored, gaps, avoidedValues });
    if (!seed) {
      return {
        seed: null,
        eligibility: { ...eligibility, eligible: false, reason: 'no_suitable_surprise_found' },
      };
    }

    if (!surpriseRespectsConstraints(seed, constraints)) {
      return {
        seed: null,
        eligibility: {
          ...eligibility,
          eligible: false,
          reason: 'surprise_blocked_by_hard_constraints',
        },
      };
    }

    logger.debug('Surprise seed proposed', {
      dimension: seed.dimension,
      origin: seed.origin,
      targetNoveltyScore: seed.targetNoveltyScore,
    });

    return { seed, eligibility };
  }

  /** Records that the user accepted a surprise, which starts the cooldown. */
  async recordSurpriseOutcome(
    userId: string,
    seed: SurpriseSeed,
    outcome: 'accepted' | 'rejected'
  ): Promise<void> {
    // Imported lazily to avoid a cycle: the event service does not know about surprises.
    const { experienceEventService } = await import('./experienceEventService');
    await experienceEventService.record({
      userId,
      type: outcome === 'accepted' ? 'questAccepted' : 'questRejected',
      source: 'questEngine',
      category: seed.dimension === 'category' ? seed.value : undefined,
      experienceType: seed.dimension === 'experienceType' ? seed.value : undefined,
      reasonCode: outcome === 'accepted' ? 'surprise_accepted' : 'surprise_rejected',
    });
  }
}

export const surpriseQuestService = new SurpriseQuestService();
export default surpriseQuestService;
