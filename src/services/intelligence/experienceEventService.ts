/**
 * EXTROVELA — Phase 11: Experience Event Service
 *
 * The single entry point for recording RAW experience events. Raw events are
 * append-only, user-owned, and are the sole source of truth from which every
 * derived artefact (signals, graph, profile, memories) can be rebuilt.
 *
 * Guarantees:
 *  - Idempotent: a repeated dedupeKey never double-counts.
 *  - Coarse-only location: `locationArea` accepts district/city labels; raw
 *    coordinates are rejected outright.
 *  - Honours the personalization master switch: with AI personalization off,
 *    nothing is recorded.
 */

import logger from '../../utils/logger';
import { intelligenceFirestore } from './intelligenceFirestore';
import { personalizationSettingsService } from './personalizationSettingsService';
import type {
  ExperienceEvent,
  ExperienceEventType,
  ExperienceEventSource,
  BudgetBandSignal,
  SocialModeSignal,
  IndoorOutdoorSignal,
  TimeOfDaySignal,
} from '../../types/experienceIntelligence';

export const EXPERIENCE_EVENT_SCHEMA_VERSION = 1;

export interface RecordEventInput {
  userId: string;
  type: ExperienceEventType;
  source: ExperienceEventSource;
  questId?: string;
  memoryId?: string;
  placeId?: string;
  category?: string;
  experienceType?: string;
  rating?: number;
  moodBefore?: string;
  moodAfter?: string;
  completed?: boolean;
  duration?: number;
  budget?: BudgetBandSignal;
  socialMode?: SocialModeSignal;
  locationArea?: string;
  timeOfDay?: TimeOfDaySignal;
  indoorOutdoor?: IndoorOutdoorSignal;
  reasonCode?: string;
  /** Override for tests/backfill. Defaults to now. */
  occurredAt?: string;
  /** Override the computed dedupe key (backfill only). */
  dedupeKey?: string;
}

/** Rejects anything that looks like a coordinate pair sneaking into an area label. */
const COORDINATE_PATTERN = /-?\d{1,3}\.\d{3,}/;

function sanitizeArea(area?: string): string | undefined {
  if (!area) return undefined;
  if (COORDINATE_PATTERN.test(area)) {
    logger.warn('Rejected locationArea containing precise coordinates');
    return undefined;
  }
  return area.trim().slice(0, 64);
}

function clampRating(rating?: number): number | undefined {
  if (typeof rating !== 'number' || Number.isNaN(rating)) return undefined;
  return Math.min(5, Math.max(1, Math.round(rating)));
}

export function deriveTimeOfDay(date: Date): TimeOfDaySignal {
  const hour = date.getHours();
  if (hour < 6) return 'lateNight';
  if (hour < 9) return 'earlyMorning';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

export class ExperienceEventService {
  /**
   * Builds a stable idempotency key. Two identical actions in the same minute
   * on the same target collapse into one event.
   */
  static buildDedupeKey(input: RecordEventInput, occurredAt: string): string {
    const minuteBucket = occurredAt.slice(0, 16); // YYYY-MM-DDTHH:mm
    const target = input.questId || input.memoryId || input.placeId || input.category || 'none';
    return `${input.type}:${target}:${minuteBucket}`;
  }

  /**
   * Records a raw event. Returns the stored event, or `null` when the write was
   * suppressed (personalization disabled) or skipped as a duplicate.
   */
  async record(input: RecordEventInput): Promise<ExperienceEvent | null> {
    if (!input.userId) {
      logger.warn('Refusing to record experience event without a userId');
      return null;
    }

    const settings = await personalizationSettingsService.getSettings(input.userId);
    if (!settings.aiPersonalizationEnabled) {
      logger.debug('Experience event suppressed: AI personalization disabled', {
        eventType: input.type,
      });
      return null;
    }

    const occurredAt = input.occurredAt || new Date().toISOString();
    const dedupeKey = input.dedupeKey || ExperienceEventService.buildDedupeKey(input, occurredAt);

    const existing = await intelligenceFirestore.findEventByDedupeKey(input.userId, dedupeKey);
    if (existing) {
      logger.debug('Duplicate experience event ignored', { eventType: input.type });
      return existing;
    }

    const event: ExperienceEvent = {
      id: `evt_${occurredAt.replace(/[^0-9]/g, '')}_${Math.random().toString(36).slice(2, 9)}`,
      userId: input.userId,
      type: input.type,
      source: input.source,
      questId: input.questId,
      memoryId: input.memoryId,
      placeId: input.placeId,
      category: input.category,
      experienceType: input.experienceType,
      rating: clampRating(input.rating),
      moodBefore: input.moodBefore,
      moodAfter: input.moodAfter,
      completed: input.completed,
      duration:
        typeof input.duration === 'number' && input.duration >= 0
          ? Math.round(input.duration)
          : undefined,
      budget: input.budget,
      socialMode: input.socialMode,
      locationArea: sanitizeArea(input.locationArea),
      timeOfDay: input.timeOfDay || deriveTimeOfDay(new Date(occurredAt)),
      indoorOutdoor: input.indoorOutdoor,
      reasonCode: input.reasonCode,
      createdAt: occurredAt,
      dedupeKey,
      schemaVersion: EXPERIENCE_EVENT_SCHEMA_VERSION,
    };

    // Strip undefined keys — Firestore rejects undefined values.
    const cleaned = Object.fromEntries(
      Object.entries(event).filter(([, v]) => v !== undefined)
    ) as unknown as ExperienceEvent;

    await intelligenceFirestore.appendEvent(cleaned);
    logger.debug('Experience event recorded', { eventType: event.type, source: event.source });
    return cleaned;
  }

  /** Reads the raw event log, newest first. */
  async getEvents(userId: string, max = 500): Promise<ExperienceEvent[]> {
    return intelligenceFirestore.getEvents(userId, max);
  }

  /** Raw events referencing a memory — used for deletion propagation. */
  async getEventsForMemory(userId: string, memoryId: string): Promise<ExperienceEvent[]> {
    const all = await intelligenceFirestore.getEvents(userId, 1000);
    return all.filter(e => e.memoryId === memoryId);
  }
}

export const experienceEventService = new ExperienceEventService();
export default experienceEventService;
