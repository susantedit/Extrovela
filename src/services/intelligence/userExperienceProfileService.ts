/**
 * EXTROVELA — Phase 11: User Experience Profile Service
 *
 * Projects the derived preference signals + experience graph into a single
 * compact, versioned document that the quest engine and the AI prompt builder
 * consume. The profile is a PROJECTION: it can always be thrown away and
 * rebuilt from raw events (see experienceProfileRebuildService).
 *
 * Size discipline matters — this document is what gets summarized into an LLM
 * prompt, so it caps values per dimension rather than embedding lifetime history.
 */

import logger from '../../utils/logger';
import { intelligenceFirestore } from './intelligenceFirestore';
import { preferenceSignalService, MIN_USABLE_CONFIDENCE } from './preferenceSignalService';
import { experienceGraphService } from './experienceGraphService';
import { personalizationSettingsService } from './personalizationSettingsService';
import {
  PREFERENCE_DIMENSIONS,
  type ExperienceEvent,
  type ExperienceGapSummary,
  type PreferenceDimension,
  type PreferenceSignal,
  type ProfileDimensionSummary,
  type UserExperienceProfile,
} from '../../types/experienceIntelligence';

export const PROFILE_SCHEMA_VERSION = 1;

/** Max values kept per dimension in each direction. Bounds prompt size. */
const MAX_VALUES_PER_DIMENSION = 5;
/** Recent-category window used for the diversity penalty. */
const RECENT_CATEGORY_LIMIT = 8;
/** Values in these dimensions are candidates for gap detection. */
const GAP_DIMENSIONS: PreferenceDimension[] = ['category', 'experienceType', 'socialMode', 'indoorOutdoor'];
/** Days of no engagement after which a previously-liked value counts as a gap. */
const GAP_ABSENCE_DAYS = 45;

const DAY_MS = 24 * 60 * 60 * 1000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function summarizeDimension(
  dimension: PreferenceDimension,
  signals: PreferenceSignal[]
): ProfileDimensionSummary {
  const forDimension = signals.filter(s => s.dimension === dimension);

  const liked = forDimension
    .filter(s => s.strength > 0.15 && s.confidence >= MIN_USABLE_CONFIDENCE)
    .sort((a, b) => b.strength * b.confidence - a.strength * a.confidence)
    .slice(0, MAX_VALUES_PER_DIMENSION)
    .map(s => ({
      value: s.value,
      strength: Number(s.strength.toFixed(3)),
      confidence: Number(s.confidence.toFixed(3)),
    }));

  const avoided = forDimension
    .filter(s => s.strength < -0.15 && s.confidence >= MIN_USABLE_CONFIDENCE)
    .sort((a, b) => a.strength * b.confidence - b.strength * a.confidence)
    .slice(0, MAX_VALUES_PER_DIMENSION)
    .map(s => ({
      value: s.value,
      strength: Number(s.strength.toFixed(3)),
      confidence: Number(s.confidence.toFixed(3)),
    }));

  return { dimension, topValues: liked, avoidedValues: avoided };
}

/**
 * Novelty appetite from behaviour: users who complete a wide spread of
 * categories and rate unfamiliar things highly get a higher appetite.
 * Bounded to [0.1, 0.6] — behaviour alone never pushes someone to mostly-stretch.
 */
export function deriveNoveltyAppetite(events: ExperienceEvent[], signals: PreferenceSignal[]): number {
  const completed = events.filter(e => e.type === 'questCompleted');
  if (completed.length < 3) return 0.2;

  const distinctCategories = new Set(completed.map(e => e.category).filter(Boolean)).size;
  const spread = Math.min(1, distinctCategories / Math.max(3, completed.length));

  const positive = signals.filter(s => s.strength > 0.3).length;
  const negative = signals.filter(s => s.strength < -0.3).length;
  const openness = positive + negative === 0 ? 0.5 : positive / (positive + negative);

  return Number(Math.min(0.6, Math.max(0.1, spread * 0.6 + openness * 0.2)).toFixed(3));
}

export function detectGaps(
  events: ExperienceEvent[],
  signals: PreferenceSignal[],
  now: Date
): ExperienceGapSummary[] {
  const gaps: ExperienceGapSummary[] = [];
  const lastSeen = new Map<string, number>();

  for (const event of events) {
    const stamp = new Date(event.createdAt).getTime();
    const record = (dimension: PreferenceDimension, value?: string) => {
      if (!value) return;
      const key = `${dimension}:${value.toLowerCase()}`;
      lastSeen.set(key, Math.max(lastSeen.get(key) || 0, stamp));
    };
    record('category', event.category);
    record('experienceType', event.experienceType);
    record('socialMode', event.socialMode);
    record('indoorOutdoor', event.indoorOutdoor);
  }

  for (const dimension of GAP_DIMENSIONS) {
    for (const signal of signals.filter(s => s.dimension === dimension)) {
      // Only previously-liked things count as a gap worth reopening.
      if (signal.strength <= 0.2) continue;
      const key = `${dimension}:${signal.value}`;
      const seenAt = lastSeen.get(key);
      if (!seenAt) {
        gaps.push({ dimension, value: signal.value, daysSinceLastEngagement: null, reason: 'neverTried' });
        continue;
      }
      const days = Math.floor((now.getTime() - seenAt) / DAY_MS);
      if (days >= GAP_ABSENCE_DAYS) {
        gaps.push({ dimension, value: signal.value, daysSinceLastEngagement: days, reason: 'longAbsence' });
      }
    }
  }

  // Underexplored: liked with very little evidence behind it.
  for (const signal of signals) {
    if (!GAP_DIMENSIONS.includes(signal.dimension)) continue;
    if (signal.strength > 0.2 && signal.sampleCount <= 1) {
      const already = gaps.some(g => g.dimension === signal.dimension && g.value === signal.value);
      if (!already) {
        gaps.push({
          dimension: signal.dimension,
          value: signal.value,
          daysSinceLastEngagement: null,
          reason: 'underexplored',
        });
      }
    }
  }

  return gaps.slice(0, 12);
}

export function computeOverallConfidence(signals: PreferenceSignal[], eventCount: number): number {
  if (signals.length === 0 || eventCount === 0) return 0;
  const usable = signals.filter(s => s.confidence >= MIN_USABLE_CONFIDENCE);
  if (usable.length === 0) return 0;

  const meanConfidence = usable.reduce((sum, s) => sum + s.confidence, 0) / usable.length;
  // Volume factor saturates around 25 events.
  const volume = 1 - Math.exp(-eventCount / 12);
  return Number(Math.min(1, meanConfidence * volume).toFixed(3));
}

export class UserExperienceProfileService {
  /** Builds a profile from the derived layer. Pure projection — no inference. */
  async buildProfile(userId: string, previousVersion?: number): Promise<UserExperienceProfile> {
    const now = new Date();
    const nowIso = now.toISOString();

    const [signals, events, repetition] = await Promise.all([
      preferenceSignalService.getSignals(userId),
      intelligenceFirestore.getEvents(userId, 1000),
      experienceGraphService.detectRepetition(userId),
    ]);

    const dimensions = PREFERENCE_DIMENSIONS.map(d => summarizeDimension(d, signals)).filter(
      d => d.topValues.length > 0 || d.avoidedValues.length > 0
    );

    const recentCategories = Array.from(
      new Set(
        events
          .filter(e => e.category)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(e => (e.category as string).toLowerCase())
      )
    ).slice(0, RECENT_CATEGORY_LIMIT);

    const frequentAreas = Array.from(
      events.reduce((map, e) => {
        if (!e.locationArea) return map;
        const key = e.locationArea.toLowerCase();
        map.set(key, (map.get(key) || 0) + 1);
        return map;
      }, new Map<string, number>())
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([area]) => area);

    const completedDurations = events
      .filter(e => e.type === 'questCompleted' && typeof e.duration === 'number')
      .map(e => e.duration as number);

    const profile: UserExperienceProfile = {
      userId,
      profileVersion: (previousVersion || 0) + 1,
      schemaVersion: PROFILE_SCHEMA_VERSION,
      dimensions,
      recentCategories,
      frequentAreas,
      noveltyAppetite: deriveNoveltyAppetite(events, signals),
      typicalDurationMinutes: median(completedDurations),
      gaps: detectGaps(events, signals, now),
      eventCount: events.length,
      signalCount: signals.length,
      overallConfidence: computeOverallConfidence(signals, events.length),
      builtAt: nowIso,
      updatedAt: nowIso,
      lastProcessedEventId: events[0]?.id,
    };

    logger.debug('Experience profile built', {
      profileVersion: profile.profileVersion,
      dimensionCount: dimensions.length,
      eventCount: profile.eventCount,
      repetitionSignals: repetition.length,
    });

    return profile;
  }

  /** Builds and persists, bumping profileVersion. */
  async rebuildAndSave(userId: string): Promise<UserExperienceProfile> {
    const previous = await intelligenceFirestore.getProfile(userId);
    const profile = await this.buildProfile(userId, previous?.profileVersion);
    await intelligenceFirestore.saveProfile(profile);
    return profile;
  }

  /**
   * Reads the current profile. Returns `null` when personalization is off —
   * callers must then fall back to generic, non-personalized generation.
   */
  async getProfile(userId: string): Promise<UserExperienceProfile | null> {
    const settings = await personalizationSettingsService.getSettings(userId);
    if (!settings.aiPersonalizationEnabled) return null;
    return intelligenceFirestore.getProfile(userId);
  }

  /** Gets the profile, building it on first use. */
  async getOrBuildProfile(userId: string): Promise<UserExperienceProfile | null> {
    const settings = await personalizationSettingsService.getSettings(userId);
    if (!settings.aiPersonalizationEnabled) return null;

    const existing = await intelligenceFirestore.getProfile(userId);
    if (existing && existing.schemaVersion === PROFILE_SCHEMA_VERSION) return existing;

    return this.rebuildAndSave(userId);
  }
}

export const userExperienceProfileService = new UserExperienceProfileService();
export default userExperienceProfileService;
