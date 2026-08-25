/**
 * EXTROVELA — Quest Engine Ranking Strategy Interface & Implementation
 */

import { QuestCandidate } from '../types';

export interface RankingStrategy {
  rank(candidates: QuestCandidate[]): QuestCandidate[];
}

export class HeuristicRankingStrategy implements RankingStrategy {
  rank(candidates: QuestCandidate[]): QuestCandidate[] {
    return [...candidates].sort((a, b) => (b.rawScore || 0) - (a.rawScore || 0));
  }
}
