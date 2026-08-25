/**
 * EXTROVELA — Phase 11: Experience Recall Service
 *
 * Turns derived memory into honest, user-facing "why this" strings:
 *   "Because you enjoyed sunset walks in Patan"
 *   "You haven't tried anything by the river in 7 weeks"
 *
 * Honesty rules (enforced, not aspirational):
 *  - never claim a fact we do not hold — every string is built from a real
 *    signal/memory record with confidence above the usable floor
 *  - never quote or paraphrase the user's private reflection text
 *  - never assert an emotional state ("you were happier") — only actions
 *  - respect memoryRecallEnabled; return [] when the user turned it off
 */

import logger from '../../utils/logger';
import { experienceMemoryService } from './experienceMemoryService';
import { preferenceSignalService, MIN_USABLE_CONFIDENCE } from './preferenceSignalService';
import { userExperienceProfileService } from './userExperienceProfileService';
import { personalizationSettingsService } from './personalizationSettingsService';
import type { ExperienceMemoryRecord, PreferenceSignal } from '../../types/experienceIntelligence';

export interface RecallLine {
  text: string;
  /** Which derived record produced this line — enables "why am I seeing this?". */
  sourceId: string;
  sourceKind: 'memory' | 'signal' | 'gap';
  confidence: number;
}

/** Minimum confidence before we will say something out loud to the user. */
const RECALL_CONFIDENCE_FLOOR = 0.4;

function humanize(value: string): string {
  return value.replace(/_/g, ' ').trim();
}

export function recallFromSignal(signal: PreferenceSignal): RecallLine | null {
  if (signal.confidence < RECALL_CONFIDENCE_FLOOR) return null;
  const readable = humanize(signal.value);

  if (signal.source === 'userExplicit' || signal.userCorrected) {
    const text =
      signal.strength >= 0
        ? `Because you told us you like ${readable}`
        : `Because you told us to skip ${readable}`;
    return { text, sourceId: signal.id, sourceKind: 'signal', confidence: signal.confidence };
  }

  if (signal.strength >= 0.3) {
    return {
      text: `Because you kept coming back to ${readable}`,
      sourceId: signal.id,
      sourceKind: 'signal',
      confidence: signal.confidence,
    };
  }

  if (signal.strength <= -0.3) {
    return {
      text: `You've passed on ${readable} before, so we left it out`,
      sourceId: signal.id,
      sourceKind: 'signal',
      confidence: signal.confidence,
    };
  }

  return null;
}

export function recallFromMemory(record: ExperienceMemoryRecord): RecallLine | null {
  if (record.confidence < RECALL_CONFIDENCE_FLOOR) return null;
  // The statement is already validated and non-clinical; present it as-is.
  return {
    text: record.statement,
    sourceId: record.id,
    sourceKind: 'memory',
    confidence: Number((record.confidence * record.freshness).toFixed(3)),
  };
}

export class ExperienceRecallService {
  /**
   * Recall lines relevant to a specific set of context terms (a candidate
   * quest's category/tags). Used for the "Why this quest?" panel.
   */
  async getRecallForContext(
    userId: string,
    contextTerms: string[],
    max = 3
  ): Promise<RecallLine[]> {
    const settings = await personalizationSettingsService.getSettings(userId);
    if (!settings.aiPersonalizationEnabled || !settings.memoryRecallEnabled) return [];

    const terms = contextTerms.map(t => t.toLowerCase()).filter(Boolean);
    if (terms.length === 0) return [];

    const [signals, memories] = await Promise.all([
      preferenceSignalService.getUsableSignals(userId),
      experienceMemoryService.getMemories(userId),
    ]);

    const lines: RecallLine[] = [];

    for (const signal of signals) {
      const matches = terms.some(
        t => signal.value.includes(t) || t.includes(signal.value)
      );
      if (!matches) continue;
      const line = recallFromSignal(signal);
      if (line) lines.push(line);
    }

    for (const memory of memories) {
      const matches = terms.some(
        t => memory.keywords.some(k => k.includes(t) || t.includes(k))
      );
      if (!matches) continue;
      const line = recallFromMemory(memory);
      if (line) lines.push(line);
    }

    const deduped = new Map<string, RecallLine>();
    for (const line of lines.sort((a, b) => b.confidence - a.confidence)) {
      if (!deduped.has(line.text)) deduped.set(line.text, line);
    }

    return Array.from(deduped.values()).slice(0, max);
  }

  /**
   * Gap-based recall: "You haven't done X in N weeks." Only produced when we
   * actually have the day count — never invented.
   */
  async getGapRecall(userId: string, max = 2): Promise<RecallLine[]> {
    const settings = await personalizationSettingsService.getSettings(userId);
    if (!settings.aiPersonalizationEnabled || !settings.memoryRecallEnabled) return [];

    const profile = await userExperienceProfileService.getProfile(userId);
    if (!profile) return [];

    return profile.gaps
      .filter(gap => gap.reason === 'longAbsence' && gap.daysSinceLastEngagement !== null)
      .slice(0, max)
      .map(gap => {
        const weeks = Math.floor((gap.daysSinceLastEngagement as number) / 7);
        const period = weeks >= 2 ? `${weeks} weeks` : `${gap.daysSinceLastEngagement} days`;
        return {
          text: `You haven't done anything ${humanize(gap.value)} in ${period}`,
          sourceId: `gap_${gap.dimension}_${gap.value}`,
          sourceKind: 'gap' as const,
          confidence: 1,
        };
      });
  }

  /**
   * The transparency surface: everything the app has learned, in plain language,
   * with the evidence count behind each item. Backs Settings → Personalization.
   */
  async getLearnedSummary(userId: string): Promise<
    Array<{
      id: string;
      dimension: string;
      value: string;
      statement: string;
      direction: 'likes' | 'avoids';
      confidence: number;
      evidenceCount: number;
      source: string;
      userCorrected: boolean;
      lastObservedAt: string;
    }>
  > {
    const signals = await preferenceSignalService.getSignals(userId);

    return signals
      .filter(s => s.confidence >= MIN_USABLE_CONFIDENCE && Math.abs(s.strength) >= 0.15)
      .sort((a, b) => b.confidence * Math.abs(b.strength) - a.confidence * Math.abs(a.strength))
      .map(s => ({
        id: s.id,
        dimension: s.dimension,
        value: s.value,
        statement:
          s.strength >= 0
            ? `You seem to like ${humanize(s.value)}`
            : `You seem to avoid ${humanize(s.value)}`,
        direction: s.strength >= 0 ? ('likes' as const) : ('avoids' as const),
        confidence: Number(s.confidence.toFixed(2)),
        evidenceCount: s.sampleCount,
        source: s.source,
        userCorrected: Boolean(s.userCorrected),
        lastObservedAt: s.lastObservedAt,
      }));
  }

  /** Honest fallback when we know too little to personalize. */
  async getColdStartExplanation(userId: string): Promise<string | null> {
    const profile = await userExperienceProfileService.getProfile(userId);
    if (!profile) return 'Personalization is off, so this is a general suggestion.';
    if (profile.overallConfidence >= 0.35) return null;

    logger.debug('Cold-start explanation surfaced', {
      overallConfidence: profile.overallConfidence,
    });
    return `We're still learning what you like — this one is a general suggestion.`;
  }
}

export const experienceRecallService = new ExperienceRecallService();
export default experienceRecallService;
