/**
 * EXTROVELA — Recap Generation Service (Phase 12)
 *
 * Produces weekly / monthly / yearly recaps that are FACTUAL by construction:
 *
 *   1. Every statistic is computed on-device from the user's real memories
 *      (recapGrounding.ts). There is no code path that writes a count the data
 *      does not support.
 *   2. The recap's FACTS (stats, real places, real firsts, real highlights) are
 *      built with NO network call and NO LLM. This is the part that renders on
 *      open and can be pre-generated in the background — opening a screen never
 *      calls a model.
 *   3. The optional NARRATIVE is fetched separately, only on an explicit user
 *      action, from the server AI layer. It is accepted only if it survives BOTH
 *      the server hallucination guard AND a second client-side grounding check.
 *      Otherwise the recap stays stats-only (narrativeAvailable:false) — the
 *      failure mode is "no story", never "a made-up story".
 *   4. Editing/adding/deleting a member memory changes the content hash, which
 *      marks a saved recap `outdated` rather than silently serving stale numbers.
 */

import { Memory } from '../../types/memory';
import {
  ExperienceRecap,
  RecapPeriodType,
  VerifiedRecapStats,
} from '../../types/recap';
import {
  periodWindow,
  memoriesInWindow,
  computeVerifiedRecapStats,
  extractVerifiedPlaces,
  extractVerifiedFirsts,
  buildHighlights,
  buildRecapContentHash,
  isRecapOutdated,
  assertNarrativeGrounded,
} from './recapGrounding';
import { firestoreService } from '../firebase/firestore';
import { intelligenceClient } from '../../lib/intelligenceClient';
import { isFeatureEnabled } from '../../config/featureFlags';

function recapId(periodType: RecapPeriodType, periodStartIso: string): string {
  return `${periodType}_${periodStartIso.slice(0, 10)}`;
}

/** The verified stat values a narrative is permitted to reference, as integers. */
function allowedNumbersFrom(stats: VerifiedRecapStats): number[] {
  return [
    stats.totalExperiences,
    stats.newPlaces,
    stats.firstTimes,
    stats.soloCount,
    stats.socialCount,
    stats.indoorCount,
    stats.outdoorCount,
    stats.favoriteCount,
    stats.distinctCategories,
    stats.distinctCities,
    Math.round(stats.averageRating),
  ];
}

export class RecapGenerationService {
  /**
   * Builds the FACTUAL recap for the period containing `refIso`. Pure data work
   * plus a hash — no network, no LLM. Safe to call on render and in the
   * background. status is 'ready' immediately; narrativeAvailable is false until
   * a narrative is explicitly requested.
   */
  computeRecap(params: {
    userId: string;
    periodType: RecapPeriodType;
    refIso: string;
    memories: Memory[];
    previousVersion?: number;
  }): ExperienceRecap {
    const { userId, periodType, refIso, memories } = params;
    const window = periodWindow(periodType, refIso);
    const inWindow = memoriesInWindow(memories, window.startIso, window.endIso);
    const stats = computeVerifiedRecapStats(inWindow);
    const memberIds = inWindow.map(m => m.id);
    const nowIso = new Date().toISOString();

    return {
      id: recapId(periodType, window.startIso),
      userId,
      periodType,
      periodStart: window.startIso,
      periodEnd: window.endIso,
      periodLabel: window.label,
      status: 'ready',
      stats,
      highlights: buildHighlights(inWindow),
      places: extractVerifiedPlaces(inWindow),
      firsts: extractVerifiedFirsts(inWindow),
      narrative: null,
      narrativeTitle: null,
      narrativeAvailable: false,
      narrativeSource: 'unavailable',
      version: (params.previousVersion ?? 0) + 1,
      contentHash: buildRecapContentHash(memberIds, stats),
      memberMemoryIds: memberIds,
      generatedAt: nowIso,
      updatedAt: nowIso,
    };
  }

  /**
   * Attaches a narrative to an already-computed recap, IF the user is eligible and
   * the server can produce a grounded one. Never mutates the facts. On any failure
   * the recap is returned unchanged except for a refreshed updatedAt — stats-only.
   *
   * Only call this from an explicit user action (e.g. tapping "Story mode"), never
   * on load: it is the one path here that spends an LLM call.
   */
  async attachNarrative(recap: ExperienceRecap, userId: string): Promise<ExperienceRecap> {
    // Feature-gated and never for an empty period (nothing truthful to narrate).
    if (!isFeatureEnabled('aiMemoryStories', userId) || recap.stats.totalExperiences === 0) {
      return { ...recap, narrativeAvailable: false, narrativeSource: 'unavailable' };
    }

    const result = await intelligenceClient.generateRecapStory({
      userId,
      periodLabel: recap.periodLabel,
      statistics: {
        totalExperiences: recap.stats.totalExperiences,
        newPlaces: recap.stats.newPlaces,
        firstTimes: recap.stats.firstTimes,
        soloCount: recap.stats.soloCount,
        socialCount: recap.stats.socialCount,
        indoorCount: recap.stats.indoorCount,
        outdoorCount: recap.stats.outdoorCount,
        favoriteCount: recap.stats.favoriteCount,
        distinctCategories: recap.stats.distinctCategories,
        distinctCities: recap.stats.distinctCities,
      },
      highlights: recap.highlights.map(h => h.title),
      places: recap.places,
      firsts: recap.firsts,
    });

    const nowIso = new Date().toISOString();

    if (!result.narrativeAvailable || !result.story) {
      return { ...recap, narrative: null, narrativeTitle: null, narrativeAvailable: false, narrativeSource: 'unavailable', updatedAt: nowIso };
    }

    // Second, independent grounding gate on the client. If the server story slips a
    // number past its own guard that our verified stats don't support, we discard
    // the prose rather than show it.
    const grounded = assertNarrativeGrounded(result.story, allowedNumbersFrom(recap.stats));
    if (!grounded) {
      return { ...recap, narrative: null, narrativeTitle: null, narrativeAvailable: false, narrativeSource: 'unavailable', updatedAt: nowIso };
    }

    return {
      ...recap,
      narrative: result.story,
      narrativeTitle: result.title,
      narrativeAvailable: true,
      narrativeSource: result.source === 'unavailable' ? 'ai-primary' : result.source,
      updatedAt: nowIso,
    };
  }

  /** Persists a recap (owner-only subcollection). */
  async save(recap: ExperienceRecap): Promise<void> {
    await firestoreService.saveExperienceRecap(recap.userId, recap);
  }

  async list(userId: string): Promise<ExperienceRecap[]> {
    return firestoreService.getExperienceRecaps(userId);
  }

  /**
   * Re-checks a saved recap against current memories. If its members/counts have
   * changed it is marked `outdated` and persisted, so the UI can show a "refresh"
   * affordance instead of stale numbers. Returns the (possibly updated) recap.
   */
  async invalidateIfStale(recap: ExperienceRecap, currentMemories: Memory[]): Promise<ExperienceRecap> {
    const inWindow = memoriesInWindow(currentMemories, recap.periodStart, recap.periodEnd);
    const currentStats = computeVerifiedRecapStats(inWindow);
    const currentIds = inWindow.map(m => m.id);
    if (isRecapOutdated(recap, currentIds, currentStats) && recap.status !== 'outdated') {
      const updated: ExperienceRecap = { ...recap, status: 'outdated', updatedAt: new Date().toISOString() };
      await this.save(updated);
      return updated;
    }
    return recap;
  }

  /**
   * Background pre-generation: computes and stores the FACTUAL recaps for the
   * given periods. No LLM. Idempotent per (periodType, periodStart) because the
   * document id is derived from them. Bumps version when a prior recap exists.
   */
  async pregenerate(params: {
    userId: string;
    memories: Memory[];
    periods: { periodType: RecapPeriodType; refIso: string }[];
  }): Promise<ExperienceRecap[]> {
    const existing = await this.list(params.userId).catch(() => [] as ExperienceRecap[]);
    const byId = new Map(existing.map(r => [r.id, r]));
    const out: ExperienceRecap[] = [];
    for (const p of params.periods) {
      const window = periodWindow(p.periodType, p.refIso);
      const prior = byId.get(recapId(p.periodType, window.startIso));
      const recap = this.computeRecap({
        userId: params.userId,
        periodType: p.periodType,
        refIso: p.refIso,
        memories: params.memories,
        previousVersion: prior?.version,
      });
      // Preserve an existing narrative if the facts have not changed.
      if (prior?.narrativeAvailable && prior.contentHash === recap.contentHash) {
        recap.narrative = prior.narrative;
        recap.narrativeTitle = prior.narrativeTitle;
        recap.narrativeAvailable = true;
        recap.narrativeSource = prior.narrativeSource;
      }
      await this.save(recap);
      out.push(recap);
    }
    return out;
  }
}

export const recapGenerationService = new RecapGenerationService();
export default recapGenerationService;
