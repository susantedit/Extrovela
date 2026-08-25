/**
 * EXTROVELA — Recap & Story Contracts (Phase 3 → extended in Phase 12)
 *
 * A recap is a FACTUAL retrospective. Every number in it is computed from the
 * user's own real memories; the optional narrative is only ever authored by the
 * server AI layer (which runs schema + hallucination guards) or absent. Nothing
 * in this file permits a fabricated count, place, date, or feeling.
 */

// ─── Legacy (Phase 3) — still consumed by RecapsView ────────────
export interface MonthlyRecap {
  month: string; // e.g. "August 2026"
  totalExperiences: number;
  newPlacesCount: number;
  firstTimeCount: number;
  soloCount: number;
  socialCount: number;
  sunsetsCount: number;
  topCategory: string;
  narrativeSummary: string; // e.g. "August was your month of small outdoor adventures."
  generatedAt: string;
}

export interface UserStats {
  totalQuestsCompleted: number;
  uniqueLocationsVisited: number;
  soloCount: number;
  socialCount: number;
  sunsetsCount: number;
  firstTimeCount: number;
  cityExplorationPercent: number;
  routineBreakerStreak: number;
  outdoorPercentage: number;
  soloPercentage: number;
  explorerArchetype: string;
}

// ─── Phase 12 — Experience Recap ────────────────────────────────

/** Matches the Firestore rule enum exactly. Do not add a value without the rule. */
export type RecapPeriodType = 'weekly' | 'monthly' | 'yearly';

/** Matches the Firestore rule enum exactly. */
export type RecapStatus = 'generating' | 'ready' | 'failed' | 'outdated';

export type RecapNarrativeSource =
  | 'ai-primary'
  | 'ai-fallback'
  | 'deterministic'
  | 'unavailable';

/**
 * Counts only. Every field is derived from real memories in the period window;
 * there is no field here a narrative could invent.
 */
export interface VerifiedRecapStats {
  totalExperiences: number;
  newPlaces: number;
  firstTimes: number;
  soloCount: number;
  socialCount: number;
  indoorCount: number;
  outdoorCount: number;
  favoriteCount: number;
  averageRating: number; // one decimal place; 0 when there are no experiences
  distinctCategories: number;
  distinctCities: number;
}

/**
 * A real memory referenced by a recap. This lives inside experienceRecaps, which
 * is owner-only, so carrying the memoryId here is safe (it is NEVER copied into
 * the public share payload — see PublicSharePayload's field denylist).
 */
export interface RecapHighlight {
  memoryId: string;
  title: string;
  placeName?: string;
  completedAt: string;
  isFavorite?: boolean;
  isFirstTime?: boolean;
}

export interface ExperienceRecap {
  id: string;
  userId: string;
  periodType: RecapPeriodType;
  /** ISO start of the period. IMMUTABLE after create (Firestore rule freezes it). */
  periodStart: string;
  periodEnd: string;
  periodLabel: string; // "August 2026" · "Week of Aug 18" · "2026"
  status: RecapStatus;

  stats: VerifiedRecapStats;
  highlights: RecapHighlight[]; // real memories, capped
  places: string[]; // real, verified place names present in the period
  firsts: string[]; // real first-time experience titles

  // The narrative is OPTIONAL. It is server-authored or absent — never fabricated
  // on the client. When narrativeAvailable is false the UI renders stats only.
  narrative: string | null;
  narrativeTitle: string | null;
  narrativeAvailable: boolean;
  narrativeSource: RecapNarrativeSource;

  version: number;
  /** Hash of member memory ids + core counts. A change flips status → outdated. */
  contentHash: string;
  memberMemoryIds: string[];

  generatedAt: string;
  updatedAt: string;
}
