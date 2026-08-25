/**
 * EXTROVELA — Phase 11: Reflection Insight Service
 *
 * Extracts STRUCTURED SIGNALS ONLY from a user's reflection. It deliberately
 * performs no psychological analysis, no sentiment scoring, and no inference
 * about the user's state of mind.
 *
 * What it reads:
 *  - tags the user explicitly selected
 *  - the rating the user explicitly gave
 *  - the mood the user explicitly picked from a fixed list
 *  - the LENGTH BUCKET of the reflection (none/short/medium/long)
 *
 * What it never does:
 *  - store, transmit, log, or send to an LLM the reflection text itself
 *  - infer emotion from prose ("you sound lonely")
 *  - derive any sensitive attribute
 *
 * The raw reflection stays user-owned in the Memory document. This service
 * only ever produces a derived, non-textual summary.
 */

import logger from '../../utils/logger';
import { intelligenceFirestore } from './intelligenceFirestore';
import { personalizationSettingsService } from './personalizationSettingsService';
import { isSafeDerivedValue } from './sensitiveAttributeGuard';
import type { Memory, MemoryMood } from '../../types/memory';
import type { ReflectionInsight } from '../../types/experienceIntelligence';

/** The only moods we accept — a closed list the user picks from. */
const ALLOWED_MOODS: MemoryMood[] = [
  'happy',
  'calm',
  'energized',
  'inspired',
  'surprised',
  'connected',
  'peaceful',
  'neutral',
  'tired',
  'disappointed',
];

export function lengthBucket(text: string | undefined): ReflectionInsight['reflectionLengthBucket'] {
  const length = (text || '').trim().length;
  if (length === 0) return 'none';
  if (length < 60) return 'short';
  if (length < 240) return 'medium';
  return 'long';
}

/**
 * Builds the derived insight. Pure and synchronous so it is trivially testable
 * and so it is obvious by inspection that `memory.reflectionText` is only ever
 * measured, never copied.
 */
export function buildInsight(memory: Memory, now = new Date()): ReflectionInsight {
  const descriptors = (memory.tags || [])
    .map(t => t.toLowerCase().trim())
    .filter(Boolean)
    // Structured descriptors only, and never a sensitive attribute.
    .filter(t => isSafeDerivedValue(t))
    .slice(0, 12);

  const selectedMood =
    memory.mood && ALLOWED_MOODS.includes(memory.mood) ? memory.mood : undefined;

  return {
    id: `insight_${memory.id}`,
    userId: memory.userId,
    memoryId: memory.id,
    descriptors,
    rating: typeof memory.rating === 'number' ? memory.rating : memory.moodRating,
    selectedMood,
    // Only the bucket. The text is never stored here.
    reflectionLengthBucket: lengthBucket(memory.reflectionText),
    createdAt: now.toISOString(),
  };
}

export class ReflectionInsightService {
  /**
   * Derives and stores the structured insight for a memory.
   * Returns null when personalization is disabled.
   */
  async recordInsight(memory: Memory): Promise<ReflectionInsight | null> {
    if (!memory.userId || !memory.id) return null;

    const settings = await personalizationSettingsService.getSettings(memory.userId);
    if (!settings.aiPersonalizationEnabled) return null;

    const insight = buildInsight(memory);
    await intelligenceFirestore.saveInsight(insight);

    // Log the shape, never the content.
    logger.debug('Reflection insight recorded', {
      descriptorCount: insight.descriptors.length,
      hasRating: insight.rating !== undefined,
      lengthBucket: insight.reflectionLengthBucket,
    });

    return insight;
  }

  async getInsights(userId: string): Promise<ReflectionInsight[]> {
    return intelligenceFirestore.getInsights(userId);
  }

  /**
   * Aggregate descriptor frequency — the only "analysis" performed, and it is
   * pure counting of user-chosen tags.
   */
  async getDescriptorFrequency(userId: string): Promise<Array<{ descriptor: string; count: number }>> {
    const insights = await this.getInsights(userId);
    const counts = new Map<string, number>();
    for (const insight of insights) {
      for (const descriptor of insight.descriptors) {
        counts.set(descriptor, (counts.get(descriptor) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([descriptor, count]) => ({ descriptor, count }))
      .sort((a, b) => b.count - a.count);
  }
}

export const reflectionInsightService = new ReflectionInsightService();
export default reflectionInsightService;
