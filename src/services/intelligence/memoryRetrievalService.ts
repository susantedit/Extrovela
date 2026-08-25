/**
 * EXTROVELA — Phase 11: Memory Retrieval Service
 *
 * Selects a SMALL, relevant subset of long-term memories for a specific
 * decision. This is the module that prevents the "one giant prompt" failure
 * mode: retrieval is scored, capped by count AND by character budget, and
 * strictly scoped to a single userId.
 *
 * Strategies:
 *   similar   — memories closest to the current context (reinforce what works)
 *   different — memories deliberately far from the current context (break routine)
 *   surprise  — low-evidence / adjacent memories, for out-of-comfort suggestions
 */

import logger from '../../utils/logger';
import { experienceMemoryService } from './experienceMemoryService';
import type {
  ExperienceMemoryRecord,
  MemoryRetrievalRequest,
  MemoryRetrievalResult,
} from '../../types/experienceIntelligence';

/** Hard character ceiling for retrieved memories in any single prompt. */
export const MAX_RETRIEVAL_CHARS = 1200;
/** Absolute cap on memories per retrieval regardless of the caller's request. */
export const MAX_RETRIEVAL_COUNT = 12;

function normalizeTerms(terms: string[]): string[] {
  return Array.from(
    new Set(
      terms
        .flatMap(t => (t || '').toLowerCase().split(/[^a-z0-9]+/))
        .filter(t => t.length > 2)
    )
  );
}

/** Jaccard-style overlap between query terms and a memory's keywords. */
export function relevanceScore(record: ExperienceMemoryRecord, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;
  const keywords = new Set(record.keywords.map(k => k.toLowerCase()));
  let hits = 0;
  for (const term of queryTerms) {
    if (keywords.has(term)) hits += 1;
    else if (record.statement.toLowerCase().includes(term)) hits += 0.5;
  }
  return hits / queryTerms.length;
}

export class MemoryRetrievalService {
  async retrieve(request: MemoryRetrievalRequest): Promise<MemoryRetrievalResult> {
    const { userId, strategy, limit } = request;

    // USER ISOLATION: memories are fetched by userId only. There is no code
    // path here that can read another user's records.
    const all = await experienceMemoryService.getMemories(userId);
    const dimensionFiltered = request.dimensions?.length
      ? all.filter(m => (m.dimension ? request.dimensions!.includes(m.dimension) : false))
      : all;

    const queryTerms = normalizeTerms(request.queryTerms);
    const scored = dimensionFiltered.map(record => {
      const relevance = relevanceScore(record, queryTerms);
      const quality = record.confidence * record.freshness;

      let score: number;
      switch (strategy) {
        case 'similar':
          score = relevance * 0.7 + quality * 0.3;
          break;
        case 'different':
          // Prefer confident memories that do NOT match the current context.
          score = (1 - relevance) * 0.6 + quality * 0.4;
          break;
        case 'surprise':
          // Prefer weakly-evidenced, low-relevance memories: the frontier.
          score = (1 - relevance) * 0.5 + (1 - record.confidence) * 0.3 + record.freshness * 0.2;
          break;
        default:
          score = quality;
      }
      return { record, score };
    });

    const requestedLimit = Math.min(Math.max(1, limit), MAX_RETRIEVAL_COUNT);
    const ordered = scored.sort((a, b) => b.score - a.score);

    const selected: ExperienceMemoryRecord[] = [];
    let approxChars = 0;
    let truncated = false;

    for (const { record } of ordered) {
      if (selected.length >= requestedLimit) {
        truncated = ordered.length > selected.length;
        break;
      }
      const cost = record.statement.length + 2;
      if (approxChars + cost > MAX_RETRIEVAL_CHARS) {
        truncated = true;
        break;
      }
      selected.push(record);
      approxChars += cost;
    }

    logger.debug('Memory retrieval complete', {
      strategy,
      candidateCount: dimensionFiltered.length,
      selectedCount: selected.length,
      approxChars,
      truncated,
    });

    return { memories: selected, strategy, approxChars, truncated };
  }

  /**
   * Convenience: the compact memory block for a quest-generation prompt.
   * Returns plain statements only — no ids, no lineage, no user identifiers.
   */
  async buildPromptMemoryBlock(
    userId: string,
    contextTerms: string[],
    strategy: MemoryRetrievalRequest['strategy'] = 'similar'
  ): Promise<string[]> {
    const result = await this.retrieve({
      userId,
      strategy,
      queryTerms: contextTerms,
      limit: 8,
    });
    return result.memories.map(m => m.statement);
  }
}

export const memoryRetrievalService = new MemoryRetrievalService();
export default memoryRetrievalService;
