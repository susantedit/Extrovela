/**
 * EXTROVELA — Recap Factual Grounding (Phase 12) — PURE, no Firebase, no network.
 *
 * This module is the factual backbone of every recap. It answers, from real
 * memories only:
 *   - which memories fall inside a period,
 *   - the verified counts for that period,
 *   - the real places / firsts / highlights,
 *   - whether an existing recap has gone stale,
 *   - and a defensive check that a server narrative did not smuggle in a number
 *     that the stats do not support.
 *
 * Nothing here invents a count, a place, a date, or a feeling. If there is no
 * data, the honest answer is a zeroed stat block — never a filler sentence.
 */

import { Memory } from '../../types/memory';
import { RecapPeriodType, VerifiedRecapStats, RecapHighlight, ExperienceRecap } from '../../types/recap';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface PeriodWindow {
  startIso: string;
  endIso: string; // exclusive upper bound
  label: string;
}

/** Monday-based start of the ISO week containing `d`, at local midnight. */
function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (copy.getDay() + 6) % 7; // 0 = Monday
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * The [start, end) window for the period that CONTAINS the reference date.
 * `refIso` defaults to the caller's supplied value — no implicit "now" so the
 * function stays pure and deterministic (and safe in the test runner).
 */
export function periodWindow(periodType: RecapPeriodType, refIso: string): PeriodWindow {
  const ref = new Date(refIso);
  if (periodType === 'weekly') {
    const start = startOfWeek(ref);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      label: `Week of ${SHORT_MONTHS[start.getMonth()]} ${start.getDate()}`,
    };
  }
  if (periodType === 'yearly') {
    const start = new Date(ref.getFullYear(), 0, 1);
    const end = new Date(ref.getFullYear() + 1, 0, 1);
    return { startIso: start.toISOString(), endIso: end.toISOString(), label: `${ref.getFullYear()}` };
  }
  // monthly
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: `${MONTHS[ref.getMonth()]} ${ref.getFullYear()}`,
  };
}

/** Memories whose completedAt falls in [startIso, endIso). */
export function memoriesInWindow(memories: Memory[], startIso: string, endIso: string): Memory[] {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return memories.filter(m => {
    const t = new Date(m.completedAt).getTime();
    return Number.isFinite(t) && t >= start && t < end;
  });
}

const OUTDOOR_TAGS = ['outdoor', 'nature', 'scenic', 'sunset', 'hike'];
const INDOOR_TAGS = ['indoor', 'sanctuary', 'teahouse', 'cafe'];
const SOCIAL_TAGS = ['social', 'friends', 'group', 'friendship'];

function hasAnyTag(m: Memory, tags: string[]): boolean {
  const lower = (m.tags || []).map(t => t.toLowerCase());
  return tags.some(t => lower.includes(t));
}

/**
 * Verified counts for a set of memories. All integers except averageRating, which
 * carries one decimal. A new place is only counted when it is BOTH flagged as a
 * first-time place AND anchored to a verified placeId — an unverified pin never
 * inflates the "new places" number.
 */
export function computeVerifiedRecapStats(memories: Memory[]): VerifiedRecapStats {
  const total = memories.length;
  let firstTimes = 0;
  let newPlaces = 0;
  let solo = 0;
  let social = 0;
  let indoor = 0;
  let outdoor = 0;
  let favorite = 0;
  let ratingSum = 0;
  const categories = new Set<string>();
  const cities = new Set<string>();

  for (const m of memories) {
    if (m.isFirstTimeExperience || m.firstTimeFlags?.newExperienceType) firstTimes += 1;
    // "New place" requires a verified placeId — not merely a dropped pin.
    if (m.firstTimeFlags?.newPlace && m.location?.placeId) newPlaces += 1;
    if (m.isFavorite) favorite += 1;
    if (hasAnyTag(m, SOCIAL_TAGS)) social += 1;
    else solo += 1;
    if (hasAnyTag(m, OUTDOOR_TAGS)) outdoor += 1;
    if (hasAnyTag(m, INDOOR_TAGS)) indoor += 1;
    ratingSum += m.rating || m.moodRating || 0;
    if (m.category) categories.add(m.category);
    if (m.location?.city) cities.add(m.location.city);
  }

  return {
    totalExperiences: total,
    newPlaces,
    firstTimes,
    soloCount: solo,
    socialCount: social,
    indoorCount: indoor,
    outdoorCount: outdoor,
    favoriteCount: favorite,
    averageRating: total > 0 ? Number((ratingSum / total).toFixed(1)) : 0,
    distinctCategories: categories.size,
    distinctCities: cities.size,
  };
}

/** Real, deduplicated place names present in the period (verified placeId first). */
export function extractVerifiedPlaces(memories: Memory[], cap = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  // Prefer memories with a verified placeId, then fall back to named places.
  const ordered = [...memories].sort((a, b) => {
    const av = a.location?.placeId ? 0 : 1;
    const bv = b.location?.placeId ? 0 : 1;
    return av - bv;
  });
  for (const m of ordered) {
    const name = m.location?.placeName || m.location?.neighborhood;
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
      if (out.length >= cap) break;
    }
  }
  return out;
}

/** Real first-time experience titles present in the period. */
export function extractVerifiedFirsts(memories: Memory[], cap = 6): string[] {
  const out: string[] = [];
  for (const m of memories) {
    if (m.isFirstTimeExperience || m.firstTimeFlags?.newPlace || m.firstTimeFlags?.newExperienceType) {
      out.push(m.title || m.questTitle);
      if (out.length >= cap) break;
    }
  }
  return out;
}

/** Real memory highlights (favorites and first-times first), capped. */
export function buildHighlights(memories: Memory[], cap = 5): RecapHighlight[] {
  const ranked = [...memories].sort((a, b) => {
    const score = (m: Memory) =>
      (m.isFavorite ? 2 : 0) + (m.isFirstTimeExperience ? 1 : 0) + (m.rating || m.moodRating || 0) / 10;
    return score(b) - score(a);
  });
  return ranked.slice(0, cap).map(m => ({
    memoryId: m.id,
    title: m.title || m.questTitle,
    placeName: m.location?.placeName,
    completedAt: m.completedAt,
    isFavorite: m.isFavorite,
    isFirstTime: m.isFirstTimeExperience,
  }));
}

/**
 * A stable, order-independent hash of the memories a recap summarizes plus its
 * headline counts. Two recaps with the same members and same counts hash equal;
 * adding, removing, or editing a member memory changes the hash → the recap is
 * outdated. FNV-1a, matching featureFlags.ts.
 */
export function buildRecapContentHash(memberMemoryIds: string[], stats: VerifiedRecapStats): string {
  const canonical =
    [...memberMemoryIds].sort().join(',') +
    '|' +
    [
      stats.totalExperiences,
      stats.newPlaces,
      stats.firstTimes,
      stats.favoriteCount,
      stats.averageRating,
      stats.distinctCategories,
      stats.distinctCities,
    ].join(',');
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** True when the recap no longer matches the current memories for its period. */
export function isRecapOutdated(recap: Pick<ExperienceRecap, 'contentHash'>, currentMemberIds: string[], currentStats: VerifiedRecapStats): boolean {
  return recap.contentHash !== buildRecapContentHash(currentMemberIds, currentStats);
}

/**
 * DEFENSE-IN-DEPTH grounding check for a server-authored narrative.
 *
 * The authoritative hallucination guard runs server-side (hallucinationGuard.js).
 * This is a second, independent net on the client: it extracts every standalone
 * integer > 1 from the story and rejects the narrative if any of them is not a
 * verified statistic. (Small words like "a"/"one" and the numbers 0/1 are ignored
 * to avoid false positives on ordinary prose.) A rejected narrative causes the
 * recap to fall back to stats-only — it is never "repaired" or shown anyway.
 */
export function assertNarrativeGrounded(story: string, allowedNumbers: number[]): boolean {
  if (!story) return true;
  const allowed = new Set(allowedNumbers.map(n => Math.round(n)));
  const matches = story.match(/\d+/g) || [];
  for (const raw of matches) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) continue;
    if (n <= 1) continue; // 0 and 1 read as ordinary article-like usage
    if (!allowed.has(n)) return false;
  }
  return true;
}
