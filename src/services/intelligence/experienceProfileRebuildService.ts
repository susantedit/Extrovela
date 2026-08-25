/**
 * EXTROVELA — Phase 11: Experience Profile Rebuild & Backfill
 *
 * Proves the raw/derived separation is real: every derived artefact can be
 * discarded and reconstructed from the append-only raw event log alone.
 *
 * Two entry points:
 *   rebuildFromRawEvents(userId)  — wipe derived, replay all raw events
 *   backfillFromHistory(userId, memories, sessions)
 *                                 — synthesize raw events for users whose
 *                                   history predates Phase 11, then rebuild
 *
 * Backfilled events carry source='backfill' so their provenance is never
 * confused with live interaction data.
 */

import logger from '../../utils/logger';
import { intelligenceFirestore } from './intelligenceFirestore';
import { experienceEventService } from './experienceEventService';
import { preferenceSignalService } from './preferenceSignalService';
import { experienceGraphService } from './experienceGraphService';
import { userExperienceProfileService } from './userExperienceProfileService';
import { experienceMemoryService } from './experienceMemoryService';
import { reflectionInsightService } from './reflectionInsightService';
import type { Memory } from '../../types/memory';
import type { QuestSession } from '../../types/quest';
import type {
  BudgetBandSignal,
  ExperienceEvent,
  IndoorOutdoorSignal,
  SocialModeSignal,
  UserExperienceProfile,
} from '../../types/experienceIntelligence';

export interface RebuildReport {
  userId: string;
  rawEventsReplayed: number;
  signalsProduced: number;
  graphNodes: number;
  graphEdges: number;
  memoriesProduced: number;
  profileVersion: number;
  durationMs: number;
  /** Events the replay could not process, with a reason code. */
  skipped: Array<{ eventId: string; reason: string }>;
}

export interface BackfillReport extends RebuildReport {
  eventsSynthesized: number;
  memoriesScanned: number;
  sessionsScanned: number;
}

/** Maps a Memory's tags to a coarse social mode. Conservative: unknown by default. */
export function inferSocialModeFromTags(tags: string[]): SocialModeSignal {
  const lower = tags.map(t => t.toLowerCase());
  if (lower.some(t => ['group', 'crowd', 'party'].includes(t))) return 'group';
  if (lower.some(t => ['friends', 'friend', 'social'].includes(t))) return 'friend';
  if (lower.some(t => ['solo', 'alone', 'quiet'].includes(t))) return 'solo';
  return 'unknown';
}

export function inferIndoorOutdoorFromTags(tags: string[]): IndoorOutdoorSignal {
  const lower = tags.map(t => t.toLowerCase());
  const outdoor = lower.some(t =>
    ['outdoor', 'nature', 'scenic', 'sunset', 'hike', 'walk', 'park', 'river'].includes(t)
  );
  const indoor = lower.some(t =>
    ['indoor', 'teahouse', 'cafe', 'sanctuary', 'museum', 'gallery', 'library'].includes(t)
  );
  if (outdoor && indoor) return 'mixed';
  if (outdoor) return 'outdoor';
  if (indoor) return 'indoor';
  return 'unknown';
}

function inferBudgetFromTags(tags: string[]): BudgetBandSignal {
  const lower = tags.map(t => t.toLowerCase());
  if (lower.includes('free')) return 'free';
  if (lower.includes('cheap') || lower.includes('low')) return 'low';
  if (lower.includes('treat') || lower.includes('splurge')) return 'treat';
  return 'unknown';
}

export class ExperienceProfileRebuildService {
  /**
   * Deletes ALL derived data and replays the raw event log in chronological
   * order. Raw events are never modified.
   */
  async rebuildFromRawEvents(userId: string): Promise<RebuildReport> {
    const startedAt = Date.now();
    const skipped: Array<{ eventId: string; reason: string }> = [];

    // 1. Read raw events BEFORE deleting derived data.
    const rawEvents = await intelligenceFirestore.getEvents(userId, 5000);
    const chronological = [...rawEvents].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    // 2. Wipe derived layer only.
    await intelligenceFirestore.deleteAllDerived(userId);

    // 3. Replay.
    for (const event of chronological) {
      try {
        if (event.schemaVersion > 1) {
          skipped.push({ eventId: event.id, reason: 'unsupported_schema_version' });
          continue;
        }
        await preferenceSignalService.applyEvent(event);
        await experienceGraphService.applyEvent(event);
      } catch (err) {
        skipped.push({
          eventId: event.id,
          reason: err instanceof Error ? err.message.slice(0, 80) : 'replay_error',
        });
      }
    }

    // 4. Re-project.
    const profile = await userExperienceProfileService.rebuildAndSave(userId);
    const memories = await experienceMemoryService.refreshMemories(userId);
    const graphStats = await experienceGraphService.getStats(userId);
    const signals = await preferenceSignalService.getSignals(userId);

    const report: RebuildReport = {
      userId,
      rawEventsReplayed: chronological.length - skipped.length,
      signalsProduced: signals.length,
      graphNodes: graphStats.nodeCount,
      graphEdges: graphStats.edgeCount,
      memoriesProduced: memories.length,
      profileVersion: profile.profileVersion,
      durationMs: Date.now() - startedAt,
      skipped,
    };

    logger.info('Experience profile rebuilt from raw events', {
      rawEventsReplayed: report.rawEventsReplayed,
      signalsProduced: report.signalsProduced,
      profileVersion: report.profileVersion,
      skippedCount: skipped.length,
      durationMs: report.durationMs,
    });

    return report;
  }

  /**
   * Synthesizes raw events from pre-Phase-11 history (memories + quest sessions),
   * then rebuilds. Idempotent: dedupeKeys are derived from the source record ids,
   * so running backfill twice does not double-count.
   */
  async backfillFromHistory(
    userId: string,
    memories: Memory[],
    sessions: QuestSession[] = []
  ): Promise<BackfillReport> {
    const startedAt = Date.now();
    let eventsSynthesized = 0;

    // 1. Memories → questCompleted + memoryCreated (+ questRated when rated).
    for (const memory of memories) {
      if (memory.userId && memory.userId !== userId) continue;

      const tags = memory.tags || [];
      const socialMode = inferSocialModeFromTags(tags);
      const indoorOutdoor = inferIndoorOutdoorFromTags(tags);
      const budget = inferBudgetFromTags(tags);
      const durationMinutes =
        memory.startedAt && memory.completedAt
          ? Math.max(
              0,
              Math.round(
                (new Date(memory.completedAt).getTime() - new Date(memory.startedAt).getTime()) /
                  60000
              )
            )
          : undefined;

      const base = {
        userId,
        source: 'backfill' as const,
        questId: memory.questId,
        memoryId: memory.id,
        placeId: memory.location?.placeId,
        category: memory.category || tags[0],
        experienceType: memory.category,
        socialMode,
        indoorOutdoor,
        budget,
        // Coarse area only — city/neighborhood, never coordinates.
        locationArea: memory.location?.neighborhood || memory.location?.city,
        occurredAt: memory.completedAt,
      };

      const completed = await experienceEventService.record({
        ...base,
        type: 'questCompleted',
        completed: true,
        duration: durationMinutes,
        moodAfter: memory.mood,
        dedupeKey: `backfill:questCompleted:${memory.id}`,
      });
      if (completed) eventsSynthesized += 1;

      const created = await experienceEventService.record({
        ...base,
        type: 'memoryCreated',
        dedupeKey: `backfill:memoryCreated:${memory.id}`,
      });
      if (created) eventsSynthesized += 1;

      const rating = memory.rating || memory.moodRating;
      if (typeof rating === 'number') {
        const rated = await experienceEventService.record({
          ...base,
          type: 'questRated',
          rating,
          dedupeKey: `backfill:questRated:${memory.id}`,
        });
        if (rated) eventsSynthesized += 1;
      }

      if (memory.location?.placeId) {
        const discovered = await experienceEventService.record({
          ...base,
          type: 'placeDiscovered',
          dedupeKey: `backfill:placeDiscovered:${memory.id}`,
        });
        if (discovered) eventsSynthesized += 1;
      }

      // Structured reflection insight (no reflection text is stored).
      await reflectionInsightService.recordInsight({ ...memory, userId });
    }

    // 2. Quest sessions → skipped / abandoned signals.
    for (const session of sessions) {
      if (session.userId !== userId) continue;
      if (session.status !== 'skipped' && session.status !== 'abandoned') continue;

      const event = await experienceEventService.record({
        userId,
        type: 'questSkipped',
        source: 'backfill',
        questId: session.questId,
        completed: false,
        duration: session.totalDurationMinutes,
        reasonCode: session.skipReason,
        occurredAt: session.completedAt || session.createdAt,
        dedupeKey: `backfill:questSkipped:${session.id}`,
      });
      if (event) eventsSynthesized += 1;
    }

    // 3. Rebuild everything from the (now enriched) raw log.
    const rebuild = await this.rebuildFromRawEvents(userId);

    const report: BackfillReport = {
      ...rebuild,
      eventsSynthesized,
      memoriesScanned: memories.length,
      sessionsScanned: sessions.length,
      durationMs: Date.now() - startedAt,
    };

    logger.info('Experience profile backfill complete', {
      eventsSynthesized,
      memoriesScanned: report.memoriesScanned,
      sessionsScanned: report.sessionsScanned,
      profileVersion: report.profileVersion,
      durationMs: report.durationMs,
    });

    return report;
  }

  /**
   * Verification helper: rebuilds into memory WITHOUT persisting, then compares
   * against the stored profile. Used by tests and by an admin consistency check.
   */
  async verifyProfileMatchesRawEvents(userId: string): Promise<{
    matches: boolean;
    differences: string[];
    stored: UserExperienceProfile | null;
  }> {
    const stored = await intelligenceFirestore.getProfile(userId);
    if (!stored) return { matches: false, differences: ['no_stored_profile'], stored: null };

    const fresh = await userExperienceProfileService.buildProfile(userId, stored.profileVersion - 1);
    const differences: string[] = [];

    if (fresh.eventCount !== stored.eventCount) differences.push('eventCount');
    if (fresh.signalCount !== stored.signalCount) differences.push('signalCount');
    if (fresh.dimensions.length !== stored.dimensions.length) differences.push('dimensionCount');
    if (fresh.recentCategories.join(',') !== stored.recentCategories.join(','))
      differences.push('recentCategories');

    return { matches: differences.length === 0, differences, stored };
  }

  /** Chronologically-sorted raw event log — the audit trail for a user. */
  async getRawEventAudit(userId: string): Promise<ExperienceEvent[]> {
    const events = await intelligenceFirestore.getEvents(userId, 5000);
    return events.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

export const experienceProfileRebuildService = new ExperienceProfileRebuildService();
export default experienceProfileRebuildService;
