/**
 * EXTROVELA — Master Quest Engine Pipeline Orchestrator (Phase 6)
 * 
 * Executes the complete real-world recommendation lifecycle:
 * Context Synthesis (Weather + Places + Sunset + GPS) -> Candidate Generation ->
 * Hard Constraint Filters -> Personalization & Context Scoring -> Safety Evaluation ->
 * Ranking -> Explainer Synthesis -> Persistence
 */

import { EngineContext, QuestCandidate, QuestRequest } from './types';
import { ContextBuilder } from './context/ContextBuilder';
import { CandidateGenerator } from './candidates/CandidateGenerator';
import { ConstraintEngine } from './filters/ConstraintEngine';
import { PersonalizationScorer } from './scoring/PersonalizationScorer';
import { SafetyEngine } from './safety/SafetyEngine';
import { HeuristicRankingStrategy, RankingStrategy } from './ranking/RankingStrategy';
import { FallbackQuestGenerator } from './fallback/FallbackGenerator';
import { UserProfile, UserPreferences } from '../types/user';
import { Quest, QuestAttempt } from '../types/quest';
import logger from '../utils/logger';

export class QuestEngine {
  private rankingStrategy: RankingStrategy;

  constructor(strategy?: RankingStrategy) {
    this.rankingStrategy = strategy || new HeuristicRankingStrategy();
  }

  async generateQuest(params: {
    user: UserProfile;
    preferences: UserPreferences;
    request: QuestRequest;
    recentQuests?: Quest[];
    completedExperiences?: QuestAttempt[];
  }): Promise<Quest> {
    logger.info('Starting Quest Engine real-world generation pipeline...', { userId: params.user.id });

    try {
      // 1. Build Multi-dimensional Real-World Context (Weather + Places + Sunset + GPS)
      const context: EngineContext = await ContextBuilder.buildContextAsync(params);

      // 2. Generate Candidate Pool (15–30 candidates)
      const rawCandidates = CandidateGenerator.generateCandidates(context);

      // 3. Apply Hard Constraint Filters (Time, weather safety, budget, environment, dislikes)
      const validCandidates = rawCandidates.filter(c => {
        const check = ConstraintEngine.validate(c, context);
        return check.valid;
      });

      if (validCandidates.length === 0) {
        logger.warn('All candidates filtered out by hard constraints; using fallback');
        return FallbackQuestGenerator.generateFallback(context);
      }

      // 4. Compute Personalization & Contextual Scores (Golden-hour boost, etc.)
      const scoredCandidates = validCandidates.map(c => PersonalizationScorer.score(c, context));

      // 5. Apply 7-Stage Safety Filter
      const safeCandidates = scoredCandidates.filter(c => {
        const safety = SafetyEngine.evaluateSafety(c);
        return safety.safe;
      });

      if (safeCandidates.length === 0) {
        return FallbackQuestGenerator.generateFallback(context);
      }

      // 6. Rank Candidates
      const ranked = this.rankingStrategy.rank(safeCandidates);
      const selected = ranked[0];

      // 7. Synthesize Real-World Contextual Explanation ("Why this quest?")
      let whyThisQuest = selected.whyThisQuest;
      if (!whyThisQuest) {
        if (context.weather?.isGoldenHour || (context.time.minutesUntilSunset && context.time.minutesUntilSunset <= 45)) {
          whyThisQuest = 'Sunset is approaching with clear skies — perfect for a golden-hour perspective walk.';
        } else if (context.currentRequest.availableTimeMinutes && context.currentRequest.availableTimeMinutes <= 30) {
          whyThisQuest = 'Fits your exact 20-minute window for a quick mindful break.';
        } else {
          whyThisQuest = 'Matches your current outdoor exploration rhythm.';
        }
      }

      const finalizedQuest: Quest = {
        ...selected,
        whyThisQuest,
      };

      logger.info('Real-world quest generation successful', { title: finalizedQuest.title, score: (selected as any).rawScore });
      return finalizedQuest;
    } catch (err) {
      logger.error('Error in Quest Engine pipeline, falling back', err);
      const fallbackContext = ContextBuilder.buildContext(params);
      return FallbackQuestGenerator.generateFallback(fallbackContext);
    }
  }
}

export const questEngine = new QuestEngine();
export default questEngine;
