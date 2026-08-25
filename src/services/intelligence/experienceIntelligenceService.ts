/**
 * EXTROVELA — Phase 11: Experience Intelligence Service (orchestrator)
 *
 * Implements the personalization pipeline:
 *
 *   User Interaction
 *     → ExperienceEvent (raw, append-only)
 *     → Normalization
 *     → PreferenceSignal (derived, confidence-tracked)
 *     → ExperienceGraph
 *     → UserExperienceProfile
 *     → Context Engine (existing ContextBuilder: weather/places/time/location)
 *     → Quest Candidate Generation (existing CandidateGenerator)
 *     → AI Reasoning (server-side, bounded context)
 *     → Safety / Feasibility Validation (existing SafetyEngine + ConstraintEngine)
 *     → Personalized Quest
 *     → User Experience
 *     → Feedback
 *     → Profile Update
 *
 * ARCHITECTURE NOTE — this service EXTENDS the existing Phase 5/6 QuestEngine
 * rather than replacing it. Personalization is injected as a RankingStrategy,
 * which is the engine's designed extension point. That placement is what makes
 * the mandated priority order structurally guaranteed rather than merely
 * intended:
 *
 *   1. Safety           — SafetyEngine, runs before ranking. Non-negotiable.
 *   2. Hard constraints  — ConstraintEngine, runs before ranking.
 *   3. Feasibility       — ContextBuilder + ConstraintEngine, before ranking.
 *   4. User preferences  — this service (ranking)
 *   5. Novelty           — this service (ranking)
 *   6. Diversity         — this service (ranking)
 *   7. Presentation      — this service (recall strings / "why this quest")
 *
 * A candidate that fails 1–3 is already gone by the time personalization runs,
 * so no preference weight, novelty target, or diversity boost can resurrect it.
 *
 * COST NOTE — nothing here calls an LLM. Opening the home screen reads a cached
 * profile and a bounded memory block. AI generation is a separate, explicit,
 * server-side call.
 */

import logger from '../../utils/logger';
import { QuestEngine } from '../../quest-engine/QuestEngine';
import { HeuristicRankingStrategy } from '../../quest-engine/ranking/RankingStrategy';
import { PersonalizationScorer } from '../../quest-engine/scoring/PersonalizationScorer';
import type { RankingStrategy } from '../../quest-engine/ranking/RankingStrategy';
import type {
  EngineContext,
  QuestCandidate,
  QuestRequest,
  QuestRejectionSignal,
} from '../../quest-engine/types';
import type { Quest, QuestAttempt } from '../../types/quest';
import type { UserPreferences, UserProfile } from '../../types/user';
import type { Memory } from '../../types/memory';

import { experienceEventService } from './experienceEventService';
import { experienceProcessingQueue } from './experienceProcessingQueue';
import { personalizationSettingsService } from './personalizationSettingsService';
import { userExperienceProfileService } from './userExperienceProfileService';
import { preferenceSignalService, MIN_USABLE_CONFIDENCE } from './preferenceSignalService';
import { memoryRetrievalService } from './memoryRetrievalService';
import { experienceRecallService, type RecallLine } from './experienceRecallService';
import { reflectionInsightService } from './reflectionInsightService';
import {
  noveltyEngine,
  noveltyFitScore,
  scoreCandidateNovelty,
} from './noveltyEngine';
import {
  diversityEngine,
  diversityAdjustment,
  DEFAULT_DIVERSITY_CONFIG,
  type RepetitionReport,
} from './diversityEngine';
import { surpriseQuestService, type SurpriseSeed } from './surpriseQuestService';
import type { RecordEventInput } from './experienceEventService';
import type {
  ExperienceEvent,
  HardConstraints,
  MemoryRetrievalStrategy,
  NoveltyDecision,
  SoftPreferences,
  UserExperienceProfile,
} from '../../types/experienceIntelligence';

/** Weight applied to each personalization component during re-ranking. */
export const RANKING_WEIGHTS = {
  /** Base engine score (context + safety-adjacent heuristics) dominates. */
  baseScore: 1,
  preference: 30,
  novelty: 20,
  diversity: 25,
} as const;

/**
 * The complete, BOUNDED personalization bundle. This is the only object that may
 * be handed to a prompt builder. It contains no raw reflections, no coordinates,
 * no other user's data, and no unbounded history.
 */
export interface PersonalizationContext {
  userId: string;
  enabled: boolean;
  profile: UserExperienceProfile | null;
  /** Plain-text memory statements only — no ids, no lineage, no identifiers. */
  memoryStatements: string[];
  /** Human-readable "because you…" lines for presentation. */
  recall: RecallLine[];
  novelty: NoveltyDecision;
  repetition: RepetitionReport;
  recentEvents: ExperienceEvent[];
  softPreferences: SoftPreferences;
  /** Surprise seed when one is due and permitted; null otherwise. */
  surprise: SurpriseSeed | null;
  /** True when we lack the evidence to personalize and should serve generic quests. */
  coldStart: boolean;
  coldStartExplanation: string | null;
}

export interface IntelligentQuestResult {
  quest: Quest;
  /** Presentation-layer explanation lines. Safe to show the user. */
  recall: RecallLine[];
  noveltyLevel: NoveltyDecision['level'];
  personalizationApplied: boolean;
  /** Why personalization was or wasn't applied. */
  personalizationReason: string;
}

function emptyNovelty(reason: string): NoveltyDecision {
  return { level: 'comfortable', targetScore: 0.2, reason };
}

function emptyRepetition(): RepetitionReport {
  return {
    isRepetitive: false,
    dominantCategory: null,
    dominanceRatio: 0,
    occurrences: 0,
    windowDays: DEFAULT_DIVERSITY_CONFIG.recentWindowDays,
  };
}

/**
 * Ranking strategy that layers preference / novelty / diversity on top of the
 * engine's own score. Operates ONLY on candidates that already passed safety,
 * hard constraints and feasibility.
 */
export class IntelligentRankingStrategy implements RankingStrategy {
  private readonly fallback = new HeuristicRankingStrategy();

  constructor(
    private readonly personalization: PersonalizationContext,
    private readonly engineContext: EngineContext
  ) {}

  rank(candidates: QuestCandidate[]): QuestCandidate[] {
    if (!this.personalization.enabled || this.personalization.coldStart) {
      // Nothing learned yet — do not pretend to personalize.
      return this.fallback.rank(candidates);
    }

    const now = new Date();
    const scored = candidates.map(candidate => {
      // 4. USER PREFERENCES — reuse the existing scorer so we don't fork logic.
      const base = PersonalizationScorer.score(candidate, this.engineContext);
      const baseScore = base.rawScore || 0;
      const preferenceScore = this.preferenceAffinity(candidate);

      // 5. NOVELTY
      const candidateNovelty = scoreCandidateNovelty(
        { category: candidate.category, tags: candidate.tags },
        this.personalization.profile
      );
      const noveltyScore = noveltyFitScore(candidateNovelty, this.personalization.novelty.targetScore);

      // 6. DIVERSITY
      const diversity = diversityAdjustment(
        { category: candidate.category, tags: candidate.tags },
        {
          recentEvents: this.personalization.recentEvents,
          repetition: this.personalization.repetition,
          now,
        }
      );

      const finalScore =
        baseScore * RANKING_WEIGHTS.baseScore +
        preferenceScore * RANKING_WEIGHTS.preference +
        noveltyScore * RANKING_WEIGHTS.novelty +
        diversity.adjustment * RANKING_WEIGHTS.diversity;

      const ranked: QuestCandidate = {
        ...base,
        rawScore: Number(finalScore.toFixed(3)),
        scoreBreakdown: {
          preferenceScore: Number((preferenceScore * RANKING_WEIGHTS.preference).toFixed(3)),
          contextScore: baseScore,
          noveltyScore: Number((noveltyScore * RANKING_WEIGHTS.novelty).toFixed(3)),
          diversityScore: Number((diversity.adjustment * RANKING_WEIGHTS.diversity).toFixed(3)),
          repetitionPenalty: this.personalization.repetition.isRepetitive ? 1 : 0,
          dislikePenalty: preferenceScore < 0 ? Math.abs(preferenceScore) : 0,
          finalScore: Number(finalScore.toFixed(3)),
        },
      };
      return ranked;
    });

    return scored.sort((a, b) => (b.rawScore || 0) - (a.rawScore || 0));
  }

  /** Signed affinity in roughly [-1, 1] from the user's usable preference signals. */
  private preferenceAffinity(candidate: QuestCandidate): number {
    const profile = this.personalization.profile;
    if (!profile) return 0;

    const terms = new Set(
      [candidate.category, ...(candidate.tags || [])]
        .filter((t): t is string => Boolean(t))
        .map(t => t.toLowerCase())
    );
    if (terms.size === 0) return 0;

    let total = 0;
    let matches = 0;

    for (const dimension of profile.dimensions) {
      for (const entry of [...dimension.topValues, ...dimension.avoidedValues]) {
        if (!terms.has(entry.value.toLowerCase())) continue;
        // Weight by confidence so low-evidence signals move the needle less.
        total += entry.strength * entry.confidence;
        matches += 1;
      }
    }

    if (matches === 0) return 0;
    return Number((total / matches).toFixed(4));
  }
}

export class ExperienceIntelligenceService {
  // ───────────────────────────────────────────────
  // Stage 1–2: interaction → raw event (never blocks the UI)
  // ───────────────────────────────────────────────

  /**
   * Records a user interaction and schedules derived-data processing.
   * Returns immediately; normalization/signals/graph/profile happen on the queue.
   */
  async recordInteraction(input: RecordEventInput): Promise<ExperienceEvent | null> {
    const event = await experienceEventService.record(input);
    if (!event) return null;

    await experienceProcessingQueue.enqueue({
      userId: event.userId,
      type: 'processEvent',
      dedupeKey: `processEvent:${event.id}`,
      payload: { eventId: event.id },
    });

    // Profile refresh is coalesced by dedupeKey: many events in one session
    // produce a single rebuild rather than one per event.
    const bucket = event.createdAt.slice(0, 13); // hour bucket
    await experienceProcessingQueue.enqueue({
      userId: event.userId,
      type: 'rebuildProfile',
      dedupeKey: `rebuildProfile:${bucket}`,
    });
    await experienceProcessingQueue.enqueue({
      userId: event.userId,
      type: 'refreshMemories',
      dedupeKey: `refreshMemories:${bucket}`,
    });

    experienceProcessingQueue.scheduleDrain(event.userId);
    return event;
  }

  /** Forces the queue to finish now. Used on app background and by tests. */
  async flush(userId: string): Promise<{ processed: number; failed: number; skipped: number }> {
    return experienceProcessingQueue.drain(userId);
  }

  // ───────────────────────────────────────────────
  // Stage 3–6: derived state → bounded personalization context
  // ───────────────────────────────────────────────

  /**
   * Assembles the bounded personalization bundle for a user.
   *
   * USER ISOLATION: every read is keyed by this userId. No call in this method
   * accepts or returns another user's data, so User A's context cannot enter
   * User B's prompt.
   */
  async getPersonalizationContext(
    userId: string,
    contextTerms: string[] = [],
    options: { strategy?: MemoryRetrievalStrategy; includeSurprise?: boolean } = {}
  ): Promise<PersonalizationContext> {
    const settings = await personalizationSettingsService.getSettings(userId);

    if (!settings.aiPersonalizationEnabled) {
      return {
        userId,
        enabled: false,
        profile: null,
        memoryStatements: [],
        recall: [],
        novelty: emptyNovelty('personalization_disabled'),
        repetition: emptyRepetition(),
        recentEvents: [],
        softPreferences: { preferredCategories: [] },
        surprise: null,
        coldStart: true,
        coldStartExplanation: null,
      };
    }

    const [profile, novelty, diversityContext] = await Promise.all([
      userExperienceProfileService.getOrBuildProfile(userId),
      noveltyEngine.decide(userId),
      diversityEngine.loadContext(userId),
    ]);

    const coldStart = !profile || profile.overallConfidence < 0.2;

    // Memory recall and long-term memory are separately opt-out-able.
    const strategy: MemoryRetrievalStrategy =
      options.strategy || (novelty.level === 'comfortable' ? 'similar' : 'different');

    const [memoryStatements, recall, coldStartExplanation] = await Promise.all([
      settings.experienceMemoryEnabled
        ? memoryRetrievalService.buildPromptMemoryBlock(userId, contextTerms, strategy)
        : Promise.resolve<string[]>([]),
      settings.memoryRecallEnabled
        ? experienceRecallService.getRecallForContext(userId, contextTerms)
        : Promise.resolve<RecallLine[]>([]),
      coldStart
        ? experienceRecallService.getColdStartExplanation(userId)
        : Promise.resolve<string | null>(null),
    ]);

    const surprise =
      options.includeSurprise && novelty.level === 'surprise'
        ? (await surpriseQuestService.proposeSurprise(userId)).seed
        : null;

    return {
      userId,
      enabled: true,
      profile,
      memoryStatements,
      recall,
      novelty,
      repetition: diversityContext.repetition,
      recentEvents: diversityContext.recentEvents,
      softPreferences: await this.deriveSoftPreferences(userId, profile),
      surprise,
      coldStart,
      coldStartExplanation,
    };
  }

  /** Projects the profile into the SoftPreferences shape the generator consumes. */
  private async deriveSoftPreferences(
    userId: string,
    profile: UserExperienceProfile | null
  ): Promise<SoftPreferences> {
    if (!profile) return { preferredCategories: [] };

    const pick = (dimension: string): string | undefined => {
      const summary = profile.dimensions.find(d => d.dimension === dimension);
      const top = summary?.topValues.find(v => v.confidence >= MIN_USABLE_CONFIDENCE);
      return top?.value;
    };

    const categorySummary = profile.dimensions.find(d => d.dimension === 'category');
    const preferredCategories = (categorySummary?.topValues || [])
      .filter(v => v.confidence >= MIN_USABLE_CONFIDENCE && v.strength > 0)
      .map(v => v.value)
      .slice(0, 5);

    const pace = pick('pace');

    void userId; // reads are already scoped by the profile we were handed
    return {
      preferredCategories,
      preferredSocialMode: pick('socialMode') as SoftPreferences['preferredSocialMode'],
      preferredIndoorOutdoor: pick('indoorOutdoor') as SoftPreferences['preferredIndoorOutdoor'],
      preferredTimeOfDay: pick('timeOfDay') as SoftPreferences['preferredTimeOfDay'],
      preferredPace:
        pace === 'slow' || pace === 'moderate' || pace === 'brisk' ? pace : undefined,
    };
  }

  /**
   * Hard constraints for the request. Derived from EXPLICIT signals only —
   * inferred behaviour never becomes a hard constraint, because a hard
   * constraint we invented would silently shrink the user's world.
   */
  async getHardConstraints(userId: string, request?: QuestRequest): Promise<HardConstraints> {
    const signals = await preferenceSignalService.getSignals(userId);
    const explicitAvoidance = signals.filter(
      s => (s.source === 'userExplicit' || s.userCorrected) && s.strength <= -0.9
    );

    return {
      maxDurationMinutes: request?.availableTimeMinutes,
      maxBudgetNpr: request?.budgetMaxNpr,
      requireIndoor: request?.environmentPreference === 'indoor' || undefined,
      exclusions: explicitAvoidance.map(s => s.value),
      accessibilityNeeds: [],
    };
  }

  // ───────────────────────────────────────────────
  // Stage 7–11: generation with safety-first ordering
  // ───────────────────────────────────────────────

  /**
   * Generates a quest with personalization applied. Delegates context building,
   * candidate generation, hard-constraint filtering and safety validation to the
   * existing engine; supplies only the ranking layer.
   */
  async generatePersonalizedQuest(params: {
    user: UserProfile;
    preferences: UserPreferences;
    request: QuestRequest;
    recentQuests?: Quest[];
    completedExperiences?: QuestAttempt[];
  }): Promise<IntelligentQuestResult> {
    const userId = params.user.id;
    const contextTerms = [
      params.request.requestedCategory,
      params.request.mood,
      params.request.energy,
      ...(params.preferences.interests || []),
    ].filter((t): t is string => Boolean(t));

    const personalization = await this.getPersonalizationContext(userId, contextTerms, {
      includeSurprise: true,
    });

    // Build the context once so the ranking strategy and the engine agree on it.
    const { ContextBuilder } = await import('../../quest-engine/context/ContextBuilder');
    const engineContext: EngineContext = await ContextBuilder.buildContextAsync({
      user: params.user,
      preferences: params.preferences,
      request: params.request,
      recentQuests: params.recentQuests,
      completedExperiences: params.completedExperiences,
    });

    const strategy = personalization.enabled
      ? new IntelligentRankingStrategy(personalization, engineContext)
      : new HeuristicRankingStrategy();

    // Safety / hard constraints / feasibility all run inside this call, BEFORE
    // our ranking strategy ever sees a candidate.
    const engine = new QuestEngine(strategy);
    const quest = await engine.generateQuest(params);

    // 7. PRESENTATION — attach recall only if the user allows it.
    const recall = personalization.recall.slice(0, 2);

    // Record the view as a raw event so "what we showed" is auditable.
    await this.recordInteraction({
      userId,
      type: 'questViewed',
      source: 'questEngine',
      questId: quest.id,
      category: quest.category,
      experienceType: quest.category,
    });

    const personalizationApplied = personalization.enabled && !personalization.coldStart;
    const personalizationReason = !personalization.enabled
      ? 'personalization_disabled_by_user'
      : personalization.coldStart
        ? 'insufficient_evidence_generic_quest_served'
        : `ranked_with_${personalization.novelty.level}_novelty`;

    logger.info('Personalized quest generated', {
      personalizationApplied,
      noveltyLevel: personalization.novelty.level,
      memoryStatementCount: personalization.memoryStatements.length,
      recallCount: recall.length,
    });

    return {
      quest,
      recall,
      noveltyLevel: personalization.novelty.level,
      personalizationApplied,
      personalizationReason,
    };
  }

  // ───────────────────────────────────────────────
  // Stage 12–14: feedback → profile update
  // ───────────────────────────────────────────────

  async recordQuestAccepted(userId: string, quest: Quest): Promise<void> {
    await this.recordInteraction({
      userId,
      type: 'questAccepted',
      source: 'questEngine',
      questId: quest.id,
      category: quest.category,
      experienceType: quest.category,
    });
  }

  async recordQuestStarted(userId: string, quest: Quest): Promise<void> {
    await this.recordInteraction({
      userId,
      type: 'questStarted',
      source: 'questEngine',
      questId: quest.id,
      category: quest.category,
    });
  }

  async recordQuestCompleted(
    userId: string,
    quest: Quest,
    outcome: { durationMinutes?: number; rating?: number; moodAfter?: string; moodBefore?: string }
  ): Promise<void> {
    await this.recordInteraction({
      userId,
      type: 'questCompleted',
      source: 'questEngine',
      questId: quest.id,
      category: quest.category,
      experienceType: quest.category,
      completed: true,
      duration: outcome.durationMinutes,
      rating: outcome.rating,
      moodBefore: outcome.moodBefore,
      moodAfter: outcome.moodAfter,
    });

    if (typeof outcome.rating === 'number') {
      await this.recordInteraction({
        userId,
        type: 'questRated',
        source: 'questEngine',
        questId: quest.id,
        category: quest.category,
        rating: outcome.rating,
      });
    }
  }

  /** Bridges the existing LearningSystem rejection signal into the event log. */
  async recordRejection(signal: QuestRejectionSignal, category?: string): Promise<void> {
    await this.recordInteraction({
      userId: signal.userId,
      type: 'questRejected',
      source: 'questEngine',
      questId: signal.questId,
      category,
      reasonCode: signal.reason,
      occurredAt: signal.timestamp,
    });
  }

  async recordSkip(
    userId: string,
    questId: string,
    reasonCode?: string,
    category?: string
  ): Promise<void> {
    await this.recordInteraction({
      userId,
      type: 'questSkipped',
      source: 'questEngine',
      questId,
      category,
      reasonCode,
      completed: false,
    });
  }

  /**
   * Called after a memory is saved. Records the raw event and derives the
   * structured reflection insight. The reflection TEXT is never copied.
   */
  async recordMemorySaved(memory: Memory): Promise<void> {
    if (!memory.userId) return;

    await this.recordInteraction({
      userId: memory.userId,
      type: 'memoryCreated',
      source: 'memoryJournal',
      questId: memory.questId,
      memoryId: memory.id,
      placeId: memory.location?.placeId,
      category: memory.category,
      rating: memory.rating ?? memory.moodRating,
      moodAfter: memory.mood,
      locationArea: memory.location?.neighborhood || memory.location?.city,
    });

    await reflectionInsightService.recordInsight(memory);
  }

  /**
   * Deletion propagation: when raw memories/events are deleted, every derived
   * artefact whose lineage points at them is purged too.
   */
  async recordMemoryDeleted(userId: string, memoryId: string): Promise<void> {
    const related = await experienceEventService.getEventsForMemory(userId, memoryId);

    await this.recordInteraction({
      userId,
      type: 'memoryDeleted',
      source: 'memoryJournal',
      memoryId,
    });

    const { intelligenceFirestore } = await import('./intelligenceFirestore');
    await intelligenceFirestore.purgeDerivedForEvents(
      userId,
      related.map(e => e.id)
    );

    await experienceProcessingQueue.enqueue({
      userId,
      type: 'rebuildProfile',
      dedupeKey: `rebuildProfile:afterDelete:${memoryId}`,
    });
    experienceProcessingQueue.scheduleDrain(userId);
  }

  // ───────────────────────────────────────────────
  // Transparency surface
  // ───────────────────────────────────────────────

  /** Everything the system has learned, in user-readable form. */
  async getTransparencyReport(userId: string): Promise<{
    settings: Awaited<ReturnType<typeof personalizationSettingsService.getSettings>>;
    learned: Awaited<ReturnType<typeof experienceRecallService.getLearnedSummary>>;
    profileVersion: number | null;
    eventCount: number;
    memoryStatements: string[];
    jobStats: Record<string, number>;
  }> {
    const [settings, learned, profile, jobStats] = await Promise.all([
      personalizationSettingsService.getSettings(userId),
      experienceRecallService.getLearnedSummary(userId),
      userExperienceProfileService.getProfile(userId),
      experienceProcessingQueue.getJobStats(userId),
    ]);

    const memoryStatements = settings.experienceMemoryEnabled
      ? await memoryRetrievalService.buildPromptMemoryBlock(userId, [], 'similar')
      : [];

    return {
      settings,
      learned,
      profileVersion: profile?.profileVersion ?? null,
      eventCount: profile?.eventCount ?? 0,
      memoryStatements,
      jobStats,
    };
  }
}

export const experienceIntelligenceService = new ExperienceIntelligenceService();
export default experienceIntelligenceService;
