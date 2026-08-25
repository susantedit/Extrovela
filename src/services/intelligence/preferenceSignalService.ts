/**
 * EXTROVELA — Phase 11: Preference Signal Service
 *
 * Converts RAW experience events into DERIVED per-dimension preference signals,
 * and owns the update mathematics:
 *
 *   GRADUAL UPDATE      strength moves toward each observation by a learning
 *                       rate that shrinks as sampleCount grows — one bad day
 *                       never flips a well-established preference.
 *   CONFIDENCE          rises with sampleCount (saturating), falls with
 *                       staleness and with contradictions.
 *   DECAY / FRESHNESS   strength and confidence decay toward neutral over
 *                       months of no observation.
 *   REINFORCEMENT       repeated same-direction observations increase both
 *                       magnitude and confidence.
 *   CONTRADICTION       an opposite-direction observation reduces confidence
 *                       before it moves strength.
 *   REVERSAL            sustained contradiction (>= REVERSAL_THRESHOLD) resets
 *                       the signal and lets it re-learn in the new direction.
 *   RECENCY WEIGHTING   recent observations count more than old ones.
 *
 * `userExplicit` signals are authoritative: inference may not overwrite them.
 */

import logger from '../../utils/logger';
import { intelligenceFirestore } from './intelligenceFirestore';
import { isSafeDerivedValue } from './sensitiveAttributeGuard';
import type {
  ExperienceEvent,
  PreferenceDimension,
  PreferenceSignal,
  PreferenceSignalObservation,
  PreferenceSignalSource,
} from '../../types/experienceIntelligence';

// ─── Tuning constants ────────────────────────────────────────
/** Learning rate at sampleCount = 1. */
const BASE_LEARNING_RATE = 0.45;
/** Learning-rate floor so a signal never becomes completely rigid. */
const MIN_LEARNING_RATE = 0.05;
/** sampleCount at which confidence reaches ~0.63 of its ceiling. */
const CONFIDENCE_SAMPLE_SCALE = 4;
/** Ceiling for inferred confidence. Only explicit statements may exceed this. */
const INFERRED_CONFIDENCE_CEILING = 0.85;
/** Half-life of an unobserved signal, in days. */
const DECAY_HALF_LIFE_DAYS = 90;
/** Confidence below which a signal is treated as unknown. */
export const MIN_USABLE_CONFIDENCE = 0.25;
/** Contradictions needed before we allow a full preference reversal. */
const REVERSAL_THRESHOLD = 3;
/** Recency weighting window in days — observations older than this count half. */
const RECENCY_WINDOW_DAYS = 30;
/** Max lineage ids retained per signal (bounded document size). */
const MAX_LINEAGE_IDS = 25;

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function daysBetween(fromIso: string, toIso: string): number {
  const delta = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(0, delta / DAY_MS);
}

export function signalId(dimension: PreferenceDimension, value: string): string {
  const safeValue = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 48);
  return `${dimension}__${safeValue}`;
}

/** Learning rate for the n-th observation. Decreases as evidence accumulates. */
export function learningRateFor(sampleCount: number): number {
  return Math.max(MIN_LEARNING_RATE, BASE_LEARNING_RATE / (1 + sampleCount * 0.35));
}

/** Confidence from evidence volume, saturating below the inferred ceiling. */
export function confidenceFromSamples(sampleCount: number, source: PreferenceSignalSource): number {
  if (source === 'userExplicit') return 1;
  const saturating = 1 - Math.exp(-sampleCount / CONFIDENCE_SAMPLE_SCALE);
  return clamp(saturating * INFERRED_CONFIDENCE_CEILING, 0, INFERRED_CONFIDENCE_CEILING);
}

/** Exponential decay factor for a signal unobserved for `days`. */
export function decayFactor(days: number): number {
  return Math.pow(0.5, days / DECAY_HALF_LIFE_DAYS);
}

/** Recency weight in (0.5, 1] applied to a single observation. */
export function recencyWeight(observedAt: string, now: string): number {
  const age = daysBetween(observedAt, now);
  return clamp(1 - 0.5 * (age / RECENCY_WINDOW_DAYS), 0.5, 1);
}

/**
 * Applies time decay to a stored signal. Pure — callers persist the result.
 * `userExplicit` signals do NOT decay: a stated preference stays stated.
 */
export function applyDecay(signal: PreferenceSignal, now: string): PreferenceSignal {
  if (signal.source === 'userExplicit' || signal.userCorrected) return signal;

  const days = daysBetween(signal.lastObservedAt, now);
  if (days < 1) return signal;

  const factor = decayFactor(days);
  return {
    ...signal,
    strength: Number((signal.strength * factor).toFixed(4)),
    confidence: Number((signal.confidence * factor).toFixed(4)),
  };
}

/**
 * Folds a single observation into an existing signal (or creates a new one).
 * Pure function — no I/O — so it is directly unit-testable.
 */
export function foldObservation(
  existing: PreferenceSignal | null,
  observation: PreferenceSignalObservation,
  userId: string,
  now: string
): PreferenceSignal {
  const id = signalId(observation.dimension, observation.value);

  // Explicit user statements always win and reset inference drift.
  if (observation.source === 'userExplicit') {
    return {
      id,
      userId,
      dimension: observation.dimension,
      value: observation.value,
      strength: clamp(observation.observedStrength, -1, 1),
      confidence: 1,
      source: 'userExplicit',
      lastObservedAt: observation.observedAt,
      sampleCount: (existing?.sampleCount || 0) + 1,
      updatedAt: now,
      sourceEventIds: dedupeLineage([
        ...(existing?.sourceEventIds || []),
        observation.sourceEventId,
      ]),
      userCorrected: existing?.userCorrected,
      contradictionCount: 0,
    };
  }

  if (!existing) {
    const sampleCount = 1;
    const weight = recencyWeight(observation.observedAt, now);
    return {
      id,
      userId,
      dimension: observation.dimension,
      value: observation.value,
      strength: Number(
        clamp(observation.observedStrength * BASE_LEARNING_RATE * weight * 2, -1, 1).toFixed(4)
      ),
      confidence: Number(confidenceFromSamples(sampleCount, observation.source).toFixed(4)),
      source: observation.source,
      lastObservedAt: observation.observedAt,
      sampleCount,
      updatedAt: now,
      sourceEventIds: [observation.sourceEventId],
      contradictionCount: 0,
    };
  }

  // An inferred observation may never overwrite an explicit statement, but it
  // is still counted so the app can tell the user their behaviour differs.
  if (existing.source === 'userExplicit' || existing.userCorrected) {
    const contradicts = Math.sign(observation.observedStrength) !== Math.sign(existing.strength);
    return {
      ...existing,
      sampleCount: existing.sampleCount + 1,
      lastObservedAt: observation.observedAt,
      updatedAt: now,
      contradictionCount: contradicts
        ? (existing.contradictionCount || 0) + 1
        : existing.contradictionCount || 0,
      sourceEventIds: dedupeLineage([...existing.sourceEventIds, observation.sourceEventId]),
    };
  }

  const decayed = applyDecay(existing, now);
  const sameDirection =
    Math.sign(observation.observedStrength) === Math.sign(decayed.strength) ||
    decayed.strength === 0 ||
    observation.observedStrength === 0;

  const contradictionCount = sameDirection
    ? Math.max(0, (decayed.contradictionCount || 0) - 1)
    : (decayed.contradictionCount || 0) + 1;

  // Sustained contradiction → allow a genuine reversal by re-seeding the signal.
  if (!sameDirection && contradictionCount >= REVERSAL_THRESHOLD) {
    logger.debug('Preference reversal accepted after sustained contradiction', {
      dimension: observation.dimension,
    });
    return {
      ...decayed,
      strength: Number(clamp(observation.observedStrength * BASE_LEARNING_RATE, -1, 1).toFixed(4)),
      confidence: Number(confidenceFromSamples(1, observation.source).toFixed(4)),
      source: observation.source,
      lastObservedAt: observation.observedAt,
      sampleCount: 1,
      updatedAt: now,
      contradictionCount: 0,
      sourceEventIds: dedupeLineage([...decayed.sourceEventIds, observation.sourceEventId]),
    };
  }

  const sampleCount = decayed.sampleCount + 1;
  const rate = learningRateFor(decayed.sampleCount) * recencyWeight(observation.observedAt, now);
  const nextStrength = clamp(
    decayed.strength + rate * (clamp(observation.observedStrength, -1, 1) - decayed.strength),
    -1,
    1
  );

  // Reinforcement raises confidence; contradiction lowers it before strength moves.
  const evidenceConfidence = confidenceFromSamples(sampleCount, observation.source);
  const contradictionPenalty = sameDirection ? 0 : 0.15 * contradictionCount;
  const nextConfidence = clamp(
    Math.max(decayed.confidence, evidenceConfidence) - contradictionPenalty,
    0,
    INFERRED_CONFIDENCE_CEILING
  );

  return {
    ...decayed,
    strength: Number(nextStrength.toFixed(4)),
    confidence: Number(nextConfidence.toFixed(4)),
    source: observation.source,
    lastObservedAt: observation.observedAt,
    sampleCount,
    updatedAt: now,
    contradictionCount,
    sourceEventIds: dedupeLineage([...decayed.sourceEventIds, observation.sourceEventId]),
  };
}

function dedupeLineage(ids: string[]): string[] {
  return Array.from(new Set(ids)).slice(-MAX_LINEAGE_IDS);
}

// ─── Event → observation normalization ───────────────────────

/**
 * Maps a raw event to the set of dimension observations it implies.
 * This is the "Normalization" stage of the intelligence pipeline.
 */
export function normalizeEventToObservations(
  event: ExperienceEvent
): PreferenceSignalObservation[] {
  const observations: PreferenceSignalObservation[] = [];

  const push = (
    dimension: PreferenceDimension,
    value: string | undefined,
    observedStrength: number,
    source: PreferenceSignalSource
  ) => {
    if (!value) return;
    if (!isSafeDerivedValue(value)) return;
    observations.push({
      dimension,
      value: value.toLowerCase(),
      observedStrength: clamp(observedStrength, -1, 1),
      source,
      observedAt: event.createdAt,
      sourceEventId: event.id,
    });
  };

  // Direction and magnitude implied by the event type.
  let direction = 0;
  let source: PreferenceSignalSource = 'inferredCompletion';

  switch (event.type) {
    case 'questCompleted':
    case 'friendQuestCompleted':
      direction = 0.7;
      source = 'inferredCompletion';
      break;
    case 'questRated':
      // 1★ → −1.0, 3★ → 0, 5★ → +1.0
      direction = typeof event.rating === 'number' ? (event.rating - 3) / 2 : 0;
      source = 'inferredRating';
      break;
    case 'questAccepted':
    case 'questStarted':
    case 'questSaved':
      direction = 0.4;
      source = 'inferredCompletion';
      break;
    case 'discoverySelected':
      direction = 0.35;
      source = 'inferredCompletion';
      break;
    case 'memoryCreated':
      direction = 0.5;
      source = 'inferredMemory';
      break;
    case 'placeDiscovered':
      direction = 0.3;
      source = 'inferredCompletion';
      break;
    case 'questRejected':
      direction = -0.7;
      source = 'inferredRejection';
      break;
    case 'questSkipped':
      direction = -0.4;
      source = 'inferredSkip';
      break;
    case 'discoveryIgnored':
      direction = -0.15;
      source = 'inferredSkip';
      break;
    case 'questViewed':
      // Viewing alone is far too weak to be a preference signal.
      return [];
    case 'memoryEdited':
    case 'memoryDeleted':
      // Handled by deletion propagation, not by preference inference.
      return [];
    default:
      return [];
  }

  if (direction === 0 && event.type !== 'questRated') return [];

  push('category', event.category, direction, source);
  push('experienceType', event.experienceType, direction, source);
  push('socialMode', event.socialMode, direction, event.socialMode ? 'inferredSocial' : source);
  push('indoorOutdoor', event.indoorOutdoor, direction, source);
  push('environment', event.indoorOutdoor, direction * 0.8, source);
  push('timeOfDay', event.timeOfDay, direction * 0.6, source);
  push('budget', event.budget, direction * 0.6, source);
  push('setting', event.locationArea, direction * 0.5, source);

  if (typeof event.duration === 'number' && event.duration > 0) {
    push('duration', durationBucket(event.duration), direction, source);
    push('pace', paceFromDuration(event.duration), direction * 0.5, source);
  }

  // A rejection specifically for cost/distance is a strong dimension signal.
  if (event.reasonCode === 'too_expensive') {
    push('budget', event.budget || 'moderate', -0.9, 'inferredRejection');
  }
  if (event.reasonCode === 'too_far') {
    push('distance', 'far', -0.9, 'inferredRejection');
  }
  if (event.reasonCode === 'bad_timing' && event.timeOfDay) {
    push('timeOfDay', event.timeOfDay, -0.6, 'inferredRejection');
  }

  return observations;
}

export function durationBucket(minutes: number): string {
  if (minutes <= 20) return 'micro';
  if (minutes <= 45) return 'short';
  if (minutes <= 90) return 'medium';
  if (minutes <= 240) return 'long';
  return 'fullDay';
}

export function paceFromDuration(minutes: number): 'slow' | 'moderate' | 'brisk' {
  if (minutes <= 25) return 'brisk';
  if (minutes <= 90) return 'moderate';
  return 'slow';
}

// ─── Service ────────────────────────────────────────────────

export class PreferenceSignalService {
  /** Applies all observations implied by one raw event. Idempotent per event id. */
  async applyEvent(event: ExperienceEvent): Promise<PreferenceSignal[]> {
    const observations = normalizeEventToObservations(event);
    if (observations.length === 0) return [];

    const now = new Date().toISOString();
    const stored = await intelligenceFirestore.getSignals(event.userId);
    const byId = new Map(stored.map(s => [s.id, s]));
    const updated: PreferenceSignal[] = [];

    for (const observation of observations) {
      const id = signalId(observation.dimension, observation.value);
      const existing = byId.get(id) || null;

      // Idempotency: this event has already been folded into this signal.
      if (existing && existing.sourceEventIds.includes(event.id)) continue;

      const next = foldObservation(existing, observation, event.userId, now);
      byId.set(id, next);
      updated.push(next);
      await intelligenceFirestore.saveSignal(next);
    }

    return updated;
  }

  /** Reads all signals, applying time decay on read (persisting nothing). */
  async getSignals(userId: string): Promise<PreferenceSignal[]> {
    const now = new Date().toISOString();
    const stored = await intelligenceFirestore.getSignals(userId);
    return stored.map(s => applyDecay(s, now));
  }

  /** Only signals confident enough to influence generation. */
  async getUsableSignals(userId: string): Promise<PreferenceSignal[]> {
    const all = await this.getSignals(userId);
    return all.filter(s => s.confidence >= MIN_USABLE_CONFIDENCE);
  }

  /**
   * User correction. The client supplies only dimension/value/strength —
   * confidence and source are set server-side by this service, never accepted
   * from the caller.
   */
  async correctSignal(
    userId: string,
    dimension: PreferenceDimension,
    value: string,
    userStrength: number
  ): Promise<PreferenceSignal | null> {
    if (!isSafeDerivedValue(value)) {
      logger.warn('Refused user correction targeting a sensitive attribute');
      return null;
    }

    const now = new Date().toISOString();
    const stored = await intelligenceFirestore.getSignals(userId);
    const id = signalId(dimension, value);
    const existing = stored.find(s => s.id === id) || null;

    const corrected: PreferenceSignal = {
      id,
      userId,
      dimension,
      value: value.toLowerCase(),
      strength: clamp(userStrength, -1, 1),
      confidence: 1, // set here, NOT by the caller
      source: 'userExplicit', // set here, NOT by the caller
      lastObservedAt: now,
      sampleCount: (existing?.sampleCount || 0) + 1,
      updatedAt: now,
      sourceEventIds: existing?.sourceEventIds || [],
      userCorrected: true,
      contradictionCount: 0,
    };

    await intelligenceFirestore.saveSignal(corrected);
    logger.info('Preference signal corrected by user', { dimension });
    return corrected;
  }

  /** Deletes one learned preference. */
  async deleteSignal(userId: string, id: string): Promise<void> {
    await intelligenceFirestore.deleteSignal(userId, id);
  }
}

export const preferenceSignalService = new PreferenceSignalService();
export default preferenceSignalService;
