/**
 * EXTROVELA — Phase 11: Experience Memory Service
 *
 * Long-term AI memory: short, factual statements derived from the signal and
 * graph layers ("Prefers solo outdoor walks in the evening"). These are what
 * get injected into an AI prompt — never raw reflections, never lifetime history.
 *
 * Rules enforced here:
 *  - every statement passes validateMemoryStatement() — no sensitive attributes,
 *    no clinical language, no emotional claims about the user
 *  - `systemGenerated: true` is set ONLY by this service
 *  - full data lineage: sourceEventIds + sourceSignalIds on every record
 *  - bounded: MAX_MEMORIES_PER_USER, with the weakest evicted first
 *  - freshness decays; reinforcement refreshes
 */

import logger from '../../utils/logger';
import { intelligenceFirestore } from './intelligenceFirestore';
import { preferenceSignalService, MIN_USABLE_CONFIDENCE } from './preferenceSignalService';
import { experienceGraphService } from './experienceGraphService';
import { personalizationSettingsService } from './personalizationSettingsService';
import { validateMemoryStatement } from './sensitiveAttributeGuard';
import type {
  ExperienceMemoryRecord,
  ExperienceMemoryType,
  PreferenceDimension,
  PreferenceSignal,
} from '../../types/experienceIntelligence';

/** Hard cap so retrieval stays cheap and prompts stay small. */
export const MAX_MEMORIES_PER_USER = 60;
/** Freshness half-life in days. */
const FRESHNESS_HALF_LIFE_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

const DIMENSION_PHRASES: Record<PreferenceDimension, { like: string; avoid: string }> = {
  experienceType: { like: 'Enjoys {v} experiences', avoid: 'Tends to pass on {v} experiences' },
  category: { like: 'Drawn to {v}', avoid: 'Rarely chooses {v}' },
  socialMode: { like: 'Prefers {v} outings', avoid: 'Avoids {v} outings' },
  environment: { like: 'Favours {v} settings', avoid: 'Avoids {v} settings' },
  duration: { like: 'Suits {v}-length outings', avoid: 'Skips {v}-length outings' },
  budget: { like: 'Comfortable with {v} budget outings', avoid: 'Declines {v} budget outings' },
  timeOfDay: { like: 'Most active in the {v}', avoid: 'Rarely goes out in the {v}' },
  distance: { like: 'Willing to travel {v}', avoid: 'Declines {v} travel' },
  indoorOutdoor: { like: 'Prefers {v} experiences', avoid: 'Avoids {v} experiences' },
  novelty: { like: 'Open to {v} experiences', avoid: 'Prefers familiar over {v}' },
  pace: { like: 'Prefers a {v} pace', avoid: 'Dislikes a {v} pace' },
  setting: { like: 'Often explores {v}', avoid: 'Rarely visits {v}' },
  weatherPreference: { like: 'Goes out in {v} weather', avoid: 'Stays in during {v} weather' },
};

function memoryTypeForDimension(dimension: PreferenceDimension, positive: boolean): ExperienceMemoryType {
  if (!positive) return 'avoidance';
  switch (dimension) {
    case 'socialMode':
      return 'social';
    case 'setting':
      return 'place';
    case 'timeOfDay':
    case 'weatherPreference':
      return 'contextual';
    case 'experienceType':
    case 'category':
      return 'experience';
    default:
      return 'preference';
  }
}

export function freshnessFor(lastReinforcedAt: string, now: Date): number {
  const days = Math.max(0, (now.getTime() - new Date(lastReinforcedAt).getTime()) / DAY_MS);
  return Number(Math.pow(0.5, days / FRESHNESS_HALF_LIFE_DAYS).toFixed(4));
}

/** Builds a factual statement from a signal. Returns null if it fails validation. */
export function statementFromSignal(signal: PreferenceSignal): string | null {
  const phrases = DIMENSION_PHRASES[signal.dimension];
  if (!phrases) return null;

  const readable = signal.value.replace(/_/g, ' ');
  const template = signal.strength >= 0 ? phrases.like : phrases.avoid;
  const statement = template.replace('{v}', readable);

  const validation = validateMemoryStatement(statement);
  if (!validation.valid) {
    logger.warn('Rejected generated memory statement', { reason: validation.reason });
    return null;
  }
  return statement;
}

export function keywordsFor(signal: PreferenceSignal): string[] {
  return Array.from(
    new Set([signal.dimension.toLowerCase(), ...signal.value.split(/[^a-z0-9]+/i).filter(Boolean)])
  ).slice(0, 8);
}

export class ExperienceMemoryService {
  /**
   * Regenerates the long-term memory set from the current derived layer.
   * Idempotent: the same signals produce the same memory ids.
   */
  async refreshMemories(userId: string): Promise<ExperienceMemoryRecord[]> {
    const settings = await personalizationSettingsService.getSettings(userId);
    if (!settings.aiPersonalizationEnabled || !settings.experienceMemoryEnabled) {
      logger.debug('Experience memory refresh skipped: disabled by user');
      return [];
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const [signals, existing, enjoyedNodes] = await Promise.all([
      preferenceSignalService.getSignals(userId),
      intelligenceFirestore.getMemoryRecords(userId),
      experienceGraphService.getEnjoyedNodes(userId, 8),
    ]);

    const existingById = new Map(existing.map(m => [m.id, m]));
    const produced: ExperienceMemoryRecord[] = [];

    // 1. Preference / avoidance memories from confident signals.
    for (const signal of signals) {
      if (signal.confidence < MIN_USABLE_CONFIDENCE) continue;
      if (Math.abs(signal.strength) < 0.25) continue;

      const statement = statementFromSignal(signal);
      if (!statement) continue;

      const id = `mem_${signal.id}`;
      const prior = existingById.get(id);
      const positive = signal.strength >= 0;

      const record: ExperienceMemoryRecord = {
        id,
        userId,
        type: memoryTypeForDimension(signal.dimension, positive),
        statement,
        confidence: Number(signal.confidence.toFixed(3)),
        freshness: 1,
        keywords: keywordsFor(signal),
        dimension: signal.dimension,
        value: signal.value,
        sourceEventIds: signal.sourceEventIds,
        sourceSignalIds: [signal.id],
        systemGenerated: true, // set here only
        createdAt: prior?.createdAt || nowIso,
        updatedAt: nowIso,
        lastReinforcedAt: signal.lastObservedAt,
      };

      record.freshness = freshnessFor(record.lastReinforcedAt, now);
      produced.push(record);
    }

    // 2. Pattern memory from the graph — what pairs with what.
    if (enjoyedNodes.length >= 2) {
      const [a, b] = enjoyedNodes;
      const statement = `Repeatedly combines ${a.label.replace(/_/g, ' ')} with ${b.label.replace(/_/g, ' ')}.`;
      const validation = validateMemoryStatement(statement);
      if (validation.valid) {
        const id = `mem_pattern_${a.id}_${b.id}`;
        const prior = existingById.get(id);
        produced.push({
          id,
          userId,
          type: 'pattern',
          statement,
          confidence: 0.6,
          freshness: 1,
          keywords: [a.key, b.key],
          sourceEventIds: [],
          sourceSignalIds: [],
          systemGenerated: true,
          createdAt: prior?.createdAt || nowIso,
          updatedAt: nowIso,
          lastReinforcedAt: nowIso,
        });
      }
    }

    // 3. Bound the set: keep the strongest confidence × freshness.
    const ranked = produced
      .sort((x, y) => y.confidence * y.freshness - x.confidence * x.freshness)
      .slice(0, MAX_MEMORIES_PER_USER);

    for (const record of ranked) {
      await intelligenceFirestore.saveMemoryRecord(record);
    }

    // Evict memories that are no longer supported by any signal.
    const keptIds = new Set(ranked.map(r => r.id));
    for (const stale of existing) {
      if (!keptIds.has(stale.id) && stale.systemGenerated) {
        await intelligenceFirestore.deleteMemoryRecord(userId, stale.id);
      }
    }

    logger.debug('Experience memories refreshed', { count: ranked.length });
    return ranked;
  }

  /** All active memories with freshness recomputed at read time. */
  async getMemories(userId: string): Promise<ExperienceMemoryRecord[]> {
    const settings = await personalizationSettingsService.getSettings(userId);
    if (!settings.aiPersonalizationEnabled || !settings.experienceMemoryEnabled) return [];

    const now = new Date();
    const records = await intelligenceFirestore.getMemoryRecords(userId);
    return records.map(r => ({ ...r, freshness: freshnessFor(r.lastReinforcedAt, now) }));
  }

  /** User-initiated deletion of a single learned memory. */
  async deleteMemory(userId: string, memoryId: string): Promise<void> {
    await intelligenceFirestore.deleteMemoryRecord(userId, memoryId);
    logger.info('Experience memory deleted by user');
  }

  /**
   * Soft-deletes instead of hard-deleting, retaining lineage for audit while
   * removing the memory from all retrieval paths.
   */
  async suppressMemory(userId: string, memoryId: string): Promise<void> {
    const records = await intelligenceFirestore.getMemoryRecords(userId);
    const target = records.find(r => r.id === memoryId);
    if (!target) return;
    await intelligenceFirestore.saveMemoryRecord({
      ...target,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

export const experienceMemoryService = new ExperienceMemoryService();
export default experienceMemoryService;
