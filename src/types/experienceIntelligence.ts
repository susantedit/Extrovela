/**
 * EXTROVELA — Phase 11: Experience Intelligence Domain Contracts
 *
 * Defines the raw → derived data model for long-term personalization:
 *
 *   ExperienceEvent (RAW, append-only, user-owned)
 *        ↓ normalization
 *   PreferenceSignal (DERIVED, per-dimension, confidence-tracked)
 *        ↓ aggregation
 *   ExperienceGraph nodes/edges (DERIVED, Firestore documents — NOT a graph DB)
 *        ↓ projection
 *   UserExperienceProfile (DERIVED, versioned snapshot)
 *        ↓ retrieval
 *   ExperienceMemory (DERIVED long-term memory, bounded, lineage-tracked)
 *
 * PRIVACY CONTRACT (enforced by sensitiveAttributeGuard.ts):
 * This model intentionally contains NO field for religion, political belief,
 * sexual orientation, medical/mental-health status, race, ethnicity, criminal
 * history, or financial status beyond the user's explicit quest budget band.
 * Never add one.
 */

// ─────────────────────────────────────────────────────────────
// 1. Raw layer — ExperienceEvent
// ─────────────────────────────────────────────────────────────

export type ExperienceEventType =
  | 'questViewed'
  | 'questAccepted'
  | 'questStarted'
  | 'questCompleted'
  | 'questSkipped'
  | 'questRejected'
  | 'questSaved'
  | 'questRated'
  | 'memoryCreated'
  | 'memoryEdited'
  | 'memoryDeleted'
  | 'placeDiscovered'
  | 'friendQuestCompleted'
  | 'discoverySelected'
  | 'discoveryIgnored';

export type ExperienceEventSource =
  | 'questEngine'
  | 'memoryJournal'
  | 'discoveryFeed'
  | 'notification'
  | 'map'
  | 'social'
  | 'userExplicit'
  | 'backfill';

/** Coarse social mode used across signals (never a sensitive attribute). */
export type SocialModeSignal = 'solo' | 'friend' | 'group' | 'strangers' | 'unknown';

/** Coarse budget band. This is the ONLY financial dimension we ever store. */
export type BudgetBandSignal = 'free' | 'low' | 'moderate' | 'treat' | 'unknown';

export type IndoorOutdoorSignal = 'indoor' | 'outdoor' | 'mixed' | 'unknown';

export type TimeOfDaySignal =
  | 'earlyMorning'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'lateNight';

/**
 * Append-only raw interaction record. One row per meaningful user action.
 * `locationArea` is a COARSE area label (district/city), never precise coordinates.
 */
export interface ExperienceEvent {
  id: string;
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
  /** Minutes. */
  duration?: number;
  budget?: BudgetBandSignal;
  socialMode?: SocialModeSignal;
  /** Coarse area only — e.g. "Patan", "Kathmandu". NEVER lat/lng. */
  locationArea?: string;
  timeOfDay?: TimeOfDaySignal;
  indoorOutdoor?: IndoorOutdoorSignal;
  /** Free-form skip/rejection reason code, not raw user text. */
  reasonCode?: string;
  createdAt: string;
  /** Client-generated idempotency key so retries never double-count. */
  dedupeKey: string;
  /** Schema version so backfill/rebuild can migrate older raw events. */
  schemaVersion: number;
}

// ─────────────────────────────────────────────────────────────
// 2. Derived layer — PreferenceSignal
// ─────────────────────────────────────────────────────────────

export type PreferenceDimension =
  | 'experienceType'
  | 'category'
  | 'socialMode'
  | 'environment'
  | 'duration'
  | 'budget'
  | 'timeOfDay'
  | 'distance'
  | 'indoorOutdoor'
  | 'novelty'
  | 'pace'
  | 'setting'
  | 'weatherPreference';

export const PREFERENCE_DIMENSIONS: readonly PreferenceDimension[] = [
  'experienceType',
  'category',
  'socialMode',
  'environment',
  'duration',
  'budget',
  'timeOfDay',
  'distance',
  'indoorOutdoor',
  'novelty',
  'pace',
  'setting',
  'weatherPreference',
] as const;

/**
 * `userExplicit` outranks every inferred source. A user telling us
 * "I hate crowds" must never be overridden by behavioural inference.
 */
export type PreferenceSignalSource =
  | 'userExplicit'
  | 'inferredCompletion'
  | 'inferredRating'
  | 'inferredRejection'
  | 'inferredSkip'
  | 'inferredMemory'
  | 'inferredSocial'
  | 'backfill';

export interface PreferenceSignal {
  id: string;
  userId: string;
  dimension: PreferenceDimension;
  /** The dimension value, e.g. category="nature", socialMode="solo". */
  value: string;
  /** Signed affinity in [-1, 1]. Negative = avoidance. */
  strength: number;
  /** [0, 1]. Grows with sample count, decays with staleness. */
  confidence: number;
  source: PreferenceSignalSource;
  lastObservedAt: string;
  sampleCount: number;
  updatedAt: string;
  /** IDs of the raw ExperienceEvents that produced this signal (bounded). */
  sourceEventIds: string[];
  /** Set when the user manually corrected this signal. Blocks re-inference drift. */
  userCorrected?: boolean;
  /** Number of times a new observation contradicted the stored direction. */
  contradictionCount?: number;
}

export interface PreferenceSignalObservation {
  dimension: PreferenceDimension;
  value: string;
  /** Signed direction/magnitude of this single observation, [-1, 1]. */
  observedStrength: number;
  source: PreferenceSignalSource;
  observedAt: string;
  sourceEventId: string;
}

// ─────────────────────────────────────────────────────────────
// 3. Derived layer — Experience Graph (Firestore documents)
// ─────────────────────────────────────────────────────────────

export type ExperienceNodeType =
  | 'user'
  | 'category'
  | 'experienceType'
  | 'place'
  | 'mood'
  | 'timeOfDay'
  | 'socialMode'
  | 'setting';

export type ExperienceEdgeType =
  | 'enjoyed'
  | 'avoided'
  | 'repeated'
  | 'discovered'
  | 'pairedWith'
  | 'ledTo';

export interface ExperienceGraphNode {
  id: string;
  userId: string;
  type: ExperienceNodeType;
  /** Human-readable key, e.g. "nature", "place_abc", "evening". */
  key: string;
  label: string;
  /** How many raw events touched this node. */
  weight: number;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
}

export interface ExperienceGraphEdge {
  id: string;
  userId: string;
  type: ExperienceEdgeType;
  fromNodeId: string;
  toNodeId: string;
  weight: number;
  /** [0,1] — how reliable this relationship is. */
  confidence: number;
  observationCount: number;
  lastObservedAt: string;
  updatedAt: string;
  sourceEventIds: string[];
}

// ─────────────────────────────────────────────────────────────
// 4. Derived layer — UserExperienceProfile
// ─────────────────────────────────────────────────────────────

export interface ProfileDimensionSummary {
  dimension: PreferenceDimension;
  topValues: Array<{ value: string; strength: number; confidence: number }>;
  avoidedValues: Array<{ value: string; strength: number; confidence: number }>;
}

export interface ExperienceGapSummary {
  dimension: PreferenceDimension;
  value: string;
  /** Days since the user last engaged with this value; null = never. */
  daysSinceLastEngagement: number | null;
  reason: 'neverTried' | 'longAbsence' | 'underexplored';
}

export interface UserExperienceProfile {
  userId: string;
  /** Incremented on every successful rebuild/update. */
  profileVersion: number;
  /** Schema version of the profile document itself. */
  schemaVersion: number;
  dimensions: ProfileDimensionSummary[];
  /** Recently engaged categories, newest first (used for diversity penalty). */
  recentCategories: string[];
  /** Coarse areas the user actually goes to. */
  frequentAreas: string[];
  /** Derived comfort/stretch appetite in [0,1]; 0 = strictly comfortable. */
  noveltyAppetite: number;
  /** Median completed quest duration in minutes; null when unknown. */
  typicalDurationMinutes: number | null;
  gaps: ExperienceGapSummary[];
  /** Total raw events considered. */
  eventCount: number;
  /** Total derived signals. */
  signalCount: number;
  /** Overall profile reliability in [0,1]. Low = fall back to generic quests. */
  overallConfidence: number;
  builtAt: string;
  updatedAt: string;
  /** Last raw event id folded in — enables incremental updates. */
  lastProcessedEventId?: string;
}

// ─────────────────────────────────────────────────────────────
// 5. Derived layer — Long-term ExperienceMemory
// ─────────────────────────────────────────────────────────────

export type ExperienceMemoryType =
  | 'preference'
  | 'avoidance'
  | 'history'
  | 'pattern'
  | 'place'
  | 'social'
  | 'experience'
  | 'contextual';

export interface ExperienceMemoryRecord {
  id: string;
  userId: string;
  type: ExperienceMemoryType;
  /**
   * Short, factual, non-clinical statement.
   * GOOD: "Prefers solo outdoor walks in the evening."
   * FORBIDDEN: anything diagnostic, emotional, or about a sensitive attribute.
   */
  statement: string;
  /** [0,1] */
  confidence: number;
  /** [0,1] — decays with time, refreshed on reinforcement. */
  freshness: number;
  /** Tokens used for retrieval matching. */
  keywords: string[];
  dimension?: PreferenceDimension;
  value?: string;
  /** Raw event ids this memory is derived from (data lineage). */
  sourceEventIds: string[];
  /** Derived-from signal ids (data lineage). */
  sourceSignalIds: string[];
  /** True when the system generated it. Client MUST NOT set this to true. */
  systemGenerated: boolean;
  createdAt: string;
  updatedAt: string;
  lastReinforcedAt: string;
  /** Soft delete so lineage/audit survives while the memory stops being used. */
  deletedAt?: string;
}

export type MemoryRetrievalStrategy = 'similar' | 'different' | 'surprise';

export interface MemoryRetrievalRequest {
  userId: string;
  strategy: MemoryRetrievalStrategy;
  /** Free-form query terms drawn from current context, never raw reflections. */
  queryTerms: string[];
  dimensions?: PreferenceDimension[];
  /** Hard cap on returned memories — protects prompt size and cost. */
  limit: number;
}

export interface MemoryRetrievalResult {
  memories: ExperienceMemoryRecord[];
  strategy: MemoryRetrievalStrategy;
  /** Approximate character budget consumed — used for cost guards. */
  approxChars: number;
  truncated: boolean;
}

// ─────────────────────────────────────────────────────────────
// 6. Processing queue
// ─────────────────────────────────────────────────────────────

export type ExperienceJobType =
  | 'processEvent'
  | 'updateSignals'
  | 'updateGraph'
  | 'rebuildProfile'
  | 'refreshMemories'
  | 'backfillProfile';

export type ExperienceJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface ExperienceProcessingJob {
  id: string;
  userId: string;
  type: ExperienceJobType;
  /** Idempotency key. A job with an existing key is skipped, never re-run. */
  dedupeKey: string;
  status: ExperienceJobStatus;
  attempts: number;
  maxAttempts: number;
  payload?: Record<string, unknown>;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ─────────────────────────────────────────────────────────────
// 7. Novelty / diversity / constraints
// ─────────────────────────────────────────────────────────────

export type NoveltyLevel = 'comfortable' | 'stretch' | 'surprise';

export interface NoveltyDecision {
  level: NoveltyLevel;
  /** Target novelty score in [0,1]: comfortable 0.2, stretch 0.5, surprise 0.8. */
  targetScore: number;
  reason: string;
}

export const NOVELTY_TARGET_SCORES: Record<NoveltyLevel, number> = {
  comfortable: 0.2,
  stretch: 0.5,
  surprise: 0.8,
};

/**
 * Hard constraints can NEVER be traded away for personalization.
 * Soft preferences may be relaxed when nothing satisfies them.
 */
export interface HardConstraints {
  maxDurationMinutes?: number;
  maxBudgetNpr?: number;
  maxDistanceMeters?: number;
  requireIndoor?: boolean;
  requireDaylight?: boolean;
  /** Explicit user-stated exclusions, e.g. "no alcohol", "no crowds". */
  exclusions: string[];
  /** Accessibility or mobility limits stated by the user. */
  accessibilityNeeds: string[];
}

export interface SoftPreferences {
  preferredCategories: string[];
  preferredSocialMode?: SocialModeSignal;
  preferredIndoorOutdoor?: IndoorOutdoorSignal;
  preferredTimeOfDay?: TimeOfDaySignal;
  preferredPace?: 'slow' | 'moderate' | 'brisk';
}

/** Result of parsing a natural-language preference the user typed. */
export interface ParsedUserPreference {
  kind: 'hardExclusion' | 'softPreference' | 'accessibility' | 'unrecognized';
  dimension?: PreferenceDimension;
  value?: string;
  /** Signed intent: +1 like, -1 dislike. */
  direction: 1 | -1 | 0;
  originalText: string;
  /** Set when the text was rejected for containing a sensitive attribute. */
  rejectedReason?: string;
}

// ─────────────────────────────────────────────────────────────
// 8. Personalization settings (user control surface)
// ─────────────────────────────────────────────────────────────

export interface PersonalizationSettings {
  userId: string;
  /** Master switch. When false, NO derived data is written or read. */
  aiPersonalizationEnabled: boolean;
  /** Allow long-term memory statements to be created and used. */
  experienceMemoryEnabled: boolean;
  /** Allow the app to surface "because you…" recall strings. */
  memoryRecallEnabled: boolean;
  /** Allow occasional out-of-comfort-zone suggestions. */
  surpriseQuestsEnabled: boolean;
  /** 0 = always comfortable, 1 = maximum stretch. Defaults to 0.2 (≈80/20). */
  noveltyPreference: number;
  updatedAt: string;
}

export const DEFAULT_PERSONALIZATION_SETTINGS: Omit<PersonalizationSettings, 'userId' | 'updatedAt'> = {
  aiPersonalizationEnabled: true,
  experienceMemoryEnabled: true,
  memoryRecallEnabled: true,
  surpriseQuestsEnabled: true,
  noveltyPreference: 0.2,
};

// ─────────────────────────────────────────────────────────────
// 9. Reflection insights (structured signals only — no psychology)
// ─────────────────────────────────────────────────────────────

/**
 * Derived from a reflection WITHOUT storing or transmitting the reflection text.
 * Deliberately contains no sentiment interpretation, no diagnosis, no
 * "you seem anxious"-style inference.
 */
export interface ReflectionInsight {
  id: string;
  userId: string;
  memoryId: string;
  /** Structured, enumerated descriptors extracted from user-chosen tags. */
  descriptors: string[];
  /** Rating the user explicitly gave, if any. */
  rating?: number;
  /** Mood the user explicitly selected — never inferred from prose. */
  selectedMood?: string;
  /** Length bucket only; the text itself is never copied here. */
  reflectionLengthBucket: 'none' | 'short' | 'medium' | 'long';
  createdAt: string;
}
