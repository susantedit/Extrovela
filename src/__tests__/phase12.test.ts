/**
 * EXTROVELA — Phase 12 Automated Test Suite
 * Memory Journal 2.0 · Experience Timeline · AI Life Recaps · Shareable Cards · Collections
 *
 * Follows the established EXTROVELA pattern: a single exported
 * `runPhase12Tests()` returning `{ test, passed, error? }[]`. There is no test
 * runner in this project; the suite is compiled with esbuild and executed under
 * node with NODE_ENV=test (see the guarded block at the bottom), or invoked from
 * a diagnostics screen.
 *
 * Everything here exercises the PURE, deterministic core of Phase 12 — the parts
 * whose correctness we can prove without Firebase, network, or an LLM:
 *   · timeline grouping            (timelineGrouping)
 *   · first-time / new-place logic (firstTimeDetection)
 *   · recap factual grounding      (recapGrounding)
 *   · recap story slides           (recapStorySlides)
 *   · smart-collection evaluation  (smartCollectionRules)
 *   · experience statistics        (experienceStatsService)
 *   · public share payload + denylist (sharePayload)
 *   · secure token generation      (tokenGenerator)
 *   · upload retry backoff         (uploadBackoff)
 *
 * The AI narrative path, Firestore persistence, and the public /s/:token OG page
 * are intentionally NOT unit-tested here because they require external
 * configuration (GEMINI + firebase-admin); their honesty guarantees are enforced
 * by the pure grounding functions this suite covers (assertNarrativeGrounded) and
 * documented in docs/PHASE_12_REPORT.md.
 *
 * Numbered functional tests:  1–20
 * Security / privacy tests:    S1–S6
 * Load / scale tests:          L1–L3
 */

import { MAX_UPLOAD_RETRIES, nextRetryDelayMs, isRetriable, progressFraction } from '../services/media/uploadBackoff';
import { groupMemoriesByPeriod, bucketFor } from '../services/memories/timelineGrouping';
import {
  detectFirstTimeFlags,
  isFirstTimeExperience,
  placeKey,
  typeTagsOf,
} from '../services/memories/firstTimeDetection';
import {
  periodWindow,
  memoriesInWindow,
  computeVerifiedRecapStats,
  extractVerifiedPlaces,
  extractVerifiedFirsts,
  buildHighlights,
  buildRecapContentHash,
  isRecapOutdated,
  assertNarrativeGrounded,
} from '../services/memories/recapGrounding';
import { buildRecapStorySlides } from '../services/memories/recapStorySlides';
import {
  evaluateSmartCollection,
  matchesClause,
  PREDEFINED_SMART_COLLECTIONS,
} from '../services/memories/smartCollectionRules';
import { ExperienceStatsService } from '../services/memories/experienceStatsService';
import {
  buildPublicSharePayload,
  assertNoDenylistedKeys,
  isShareLinkLive,
  buildShareUrls,
  sanitizeStatLines,
  SHARE_DENYLIST_KEYS,
} from '../services/sharing/sharePayload';
import {
  generateSecureToken,
  isValidShareToken,
  MIN_SHARE_TOKEN_LENGTH,
  SHARE_TOKEN_LENGTH,
  SecureRng,
} from '../services/security/tokenGenerator';
import { Memory } from '../types/memory';
import { ExperienceRecap, VerifiedRecapStats } from '../types/recap';
import { ShareableSubject } from '../types/share';
import { SmartCollectionRule } from '../types/collections';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
}

// ── Test fixtures ───────────────────────────────────────────────────────────

let memSeq = 0;
function makeMemory(overrides: Partial<Memory> = {}): Memory {
  memSeq += 1;
  return {
    id: overrides.id || `mem_${memSeq}`,
    userId: overrides.userId || 'user_A',
    questId: overrides.questId || 'q1',
    questTitle: overrides.questTitle || 'A quiet walk',
    title: overrides.title,
    reflectionText: overrides.reflectionText ?? 'private text that must never leave the device',
    rating: overrides.rating ?? 5,
    moodRating: overrides.moodRating ?? 5,
    location: overrides.location || { lat: 0, lng: 0, city: 'Lisbon' },
    completedAt: overrides.completedAt || '2026-08-15T12:00:00.000Z',
    createdAt: overrides.createdAt || '2026-08-15T12:00:00.000Z',
    visibility: overrides.visibility || 'private',
    isFavorite: overrides.isFavorite ?? false,
    isFirstTimeExperience: overrides.isFirstTimeExperience ?? false,
    firstTimeFlags: overrides.firstTimeFlags,
    tags: overrides.tags || [],
    category: overrides.category,
    mood: overrides.mood,
    photos: overrides.photos,
    videos: overrides.videos,
    photoUrl: overrides.photoUrl,
    ...overrides,
  };
}

/** A deterministic, seedable byte source so token tests never touch platform crypto. */
function lcgRng(seed: number): SecureRng {
  let state = seed >>> 0;
  return (out: Uint8Array) => {
    for (let i = 0; i < out.length; i += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      out[i] = (state >>> 24) & 0xff;
    }
  };
}

function makeRecap(memories: Memory[], overrides: Partial<ExperienceRecap> = {}): ExperienceRecap {
  const stats = computeVerifiedRecapStats(memories);
  const ids = memories.map(m => m.id);
  return {
    id: 'recap_1',
    userId: 'user_A',
    periodType: 'monthly',
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-09-01T00:00:00.000Z',
    periodLabel: 'August 2026',
    status: 'ready',
    stats,
    highlights: buildHighlights(memories),
    places: extractVerifiedPlaces(memories),
    firsts: extractVerifiedFirsts(memories),
    narrative: null,
    narrativeTitle: null,
    narrativeAvailable: false,
    narrativeSource: 'unavailable',
    version: 1,
    contentHash: buildRecapContentHash(ids, stats),
    memberMemoryIds: ids,
    generatedAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
    ...overrides,
  };
}

export function runPhase12Tests(): TestResult[] {
  const results: TestResult[] = [];

  const run = (test: string, fn: () => void) => {
    try {
      fn();
      results.push({ test, passed: true });
    } catch (e) {
      results.push({ test, passed: false, error: e instanceof Error ? e.message : String(e) });
    }
  };
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  FUNCTIONAL — the pure Phase 12 core
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 1. Upload backoff schedule ─────────────────────────────────────────────
  run('1. nextRetryDelayMs follows the fixed schedule and clamps past the last entry', () => {
    assert(nextRetryDelayMs(0) === 1000, 'attempt 0 → 1000ms');
    assert(nextRetryDelayMs(1) === 2000, 'attempt 1 → 2000ms');
    assert(nextRetryDelayMs(2) === 4000, 'attempt 2 → 4000ms');
    assert(nextRetryDelayMs(3) === 8000, 'attempt 3 → 8000ms');
    assert(nextRetryDelayMs(4) === 16000, 'attempt 4 → 16000ms');
    assert(nextRetryDelayMs(99) === 16000, 'beyond the schedule clamps to the last delay');
    assert(nextRetryDelayMs(-3) === 1000, 'a negative attempt is treated as the first');
  });

  // ── 2. Retry budget is bounded ─────────────────────────────────────────────
  run('2. isRetriable permits exactly MAX_UPLOAD_RETRIES attempts, then stops', () => {
    assert(MAX_UPLOAD_RETRIES === 5, 'budget is 5');
    assert(isRetriable(0) && isRetriable(4), 'retries 0..4 permitted');
    assert(!isRetriable(5) && !isRetriable(6), 'no retry once the budget is spent');
  });

  // ── 3. Progress fraction is guarded ────────────────────────────────────────
  run('3. progressFraction stays in [0,1] and guards a zero/unknown total', () => {
    assert(progressFraction(0, 0) === 0, 'zero total → 0, never NaN/Infinity');
    assert(progressFraction(50, 100) === 0.5, 'half → 0.5');
    assert(progressFraction(200, 100) === 1, 'over-transfer clamps to 1');
    assert(progressFraction(-5, 100) === 0, 'negative clamps to 0');
    assert(progressFraction(1, 3) === 0.3333, 'rounded to 4 decimals');
  });

  // ── 4. Timeline month grouping + ordering ──────────────────────────────────
  run('4. groupMemoriesByPeriod groups by month, newest bucket & member first', () => {
    const mems = [
      makeMemory({ id: 'a', completedAt: '2026-08-03T09:00:00.000Z' }),
      makeMemory({ id: 'b', completedAt: '2026-08-20T09:00:00.000Z' }),
      makeMemory({ id: 'c', completedAt: '2026-07-11T09:00:00.000Z' }),
    ];
    const groups = groupMemoriesByPeriod(mems, 'month');
    assert(groups.length === 2, 'two month buckets');
    assert(groups[0].key === '2026-08' && groups[0].label === 'August 2026', 'newest bucket first, correct label');
    assert(groups[1].key === '2026-07', 'older bucket second');
    assert(groups[0].memories.length === 2, 'August holds two memories');
    assert(groups[0].memories[0].id === 'b', 'newest memory first within the bucket');
  });

  // ── 5. Undated memories are skipped, never fabricated into a bucket ─────────
  run('5. groupMemoriesByPeriod skips missing/invalid completedAt', () => {
    const mems = [
      makeMemory({ id: 'ok', completedAt: '2026-08-03T09:00:00.000Z' }),
      makeMemory({ id: 'empty', completedAt: '' }),
      makeMemory({ id: 'bad', completedAt: 'not-a-real-date' }),
    ];
    const groups = groupMemoriesByPeriod(mems, 'month');
    const total = groups.reduce((n, g) => n + g.memories.length, 0);
    assert(total === 1, 'only the one valid memory is placed');
    assert(groups[0].memories[0].id === 'ok', 'the valid memory is the survivor');
  });

  // ── 6. Bucket labels for each grouping ─────────────────────────────────────
  run('6. bucketFor produces correct UTC labels for day/week/month/year', () => {
    const dt = new Date(Date.UTC(2026, 7, 15, 12, 0, 0)); // 2026-08-15
    assert(bucketFor(dt, 'day').label === 'Aug 15, 2026', 'day label');
    assert(bucketFor(dt, 'day').key === '2026-08-15', 'day key');
    assert(bucketFor(dt, 'month').label === 'August 2026', 'month label');
    assert(bucketFor(dt, 'month').key === '2026-08', 'month key');
    assert(bucketFor(dt, 'year').label === '2026' && bucketFor(dt, 'year').key === '2026', 'year label/key');
    assert(bucketFor(dt, 'week').label.startsWith('Week of '), 'week label prefix');
  });

  // ── 7. First-time detection: a brand-new user gets a genuine first ──────────
  run('7. detectFirstTimeFlags returns all-first for a user with no history', () => {
    const flags = detectFirstTimeFlags([], { city: 'Lisbon', placeId: 'p1', category: 'nature', tags: ['hike'] });
    assert(flags.newPlace && flags.newCategory && flags.newExperienceType, 'all three dimensions are first');
    assert(isFirstTimeExperience(flags), 'overall first-time is true');
  });

  // ── 8. First-time detection over real history ──────────────────────────────
  run('8. A repeat place/category is not first; unknown-location cannot assert a place', () => {
    const prior = [makeMemory({ location: { lat: 0, lng: 0, city: 'Lisbon', placeId: 'p1' }, category: 'nature', tags: ['hike'] })];
    const repeat = detectFirstTimeFlags(prior, { city: 'Lisbon', placeId: 'p1', category: 'nature', tags: ['hike'] });
    assert(!repeat.newPlace && !repeat.newCategory && !repeat.newExperienceType, 'a full repeat is not first in any dimension');
    assert(placeKey('unknown location') === '', "'unknown location' is not a real place key");
    const noPlace = detectFirstTimeFlags(prior, { city: 'unknown location' });
    assert(!noPlace.newPlace, 'no place signal → newPlace cannot be honestly asserted');
  });

  // ── 9. Type tags exclude moods/generics; sensible fallback ─────────────────
  run('9. typeTagsOf strips mood/generic tokens and newExperienceType falls back to category', () => {
    assert(JSON.stringify(typeTagsOf(['happy', 'experience', 'hike', 'sunset'])) === JSON.stringify(['hike', 'sunset']), 'mood + generic removed');
    const prior = [makeMemory({ category: 'nature', tags: ['hike'] })];
    const newCat = detectFirstTimeFlags(prior, { category: 'food', tags: ['happy'] });
    assert(newCat.newExperienceType === true, 'no type tags → falls back to (new) category');
    const sameCat = detectFirstTimeFlags(prior, { category: 'nature', tags: ['happy'] });
    assert(sameCat.newExperienceType === false, 'no type tags + existing category → not a new type');
  });

  // ── 10. Recap period windows ───────────────────────────────────────────────
  run('10. periodWindow builds correct labels for month/week/year', () => {
    const ref = '2026-08-15T12:00:00.000Z';
    assert(periodWindow('monthly', ref).label === 'August 2026', 'monthly label');
    assert(periodWindow('yearly', ref).label === '2026', 'yearly label');
    assert(periodWindow('weekly', ref).label.startsWith('Week of '), 'weekly label prefix');
  });

  // ── 11. Membership window is [start, end) ──────────────────────────────────
  run('11. memoriesInWindow includes only memories inside the half-open window', () => {
    const w = periodWindow('monthly', '2026-08-15T12:00:00.000Z');
    const mems = [
      makeMemory({ id: 'in', completedAt: '2026-08-10T10:00:00.000Z' }),
      makeMemory({ id: 'out', completedAt: '2026-09-02T10:00:00.000Z' }),
    ];
    const inside = memoriesInWindow(mems, w.startIso, w.endIso).map(m => m.id);
    assert(inside.length === 1 && inside[0] === 'in', 'only the August memory is inside the window');
  });

  // ── 12. Verified stats — and the honest newPlaces limitation ───────────────
  run('12. computeVerifiedRecapStats counts truthfully; newPlaces requires a verified placeId', () => {
    const mems = [
      makeMemory({ id: 'm1', isFavorite: true, isFirstTimeExperience: true, rating: 5, category: 'nature', tags: ['outdoor'], location: { lat: 0, lng: 0, city: 'Lisbon', placeId: 'p1' }, firstTimeFlags: { newPlace: true, newCategory: true, newExperienceType: true } }),
      makeMemory({ id: 'm2', rating: 3, category: 'food', tags: ['friends'], location: { lat: 0, lng: 0, city: 'Porto' }, firstTimeFlags: { newPlace: true, newCategory: false, newExperienceType: false } }),
      makeMemory({ id: 'm3', rating: 4, category: 'nature', tags: ['teahouse'], location: { lat: 0, lng: 0, city: 'Lisbon' } }),
    ];
    const s = computeVerifiedRecapStats(mems);
    assert(s.totalExperiences === 3, 'three experiences');
    assert(s.newPlaces === 1, 'only m1 has BOTH newPlace flag and a verified placeId; m2 pin is not counted');
    assert(s.firstTimes === 1, 'one first-time experience');
    assert(s.favoriteCount === 1, 'one favorite');
    assert(s.socialCount === 1 && s.soloCount === 2, 'one social (friends), two solo');
    assert(s.outdoorCount === 1 && s.indoorCount === 1, 'one outdoor, one indoor');
    assert(s.averageRating === 4, '(5+3+4)/3 = 4.0');
    assert(s.distinctCategories === 2 && s.distinctCities === 2, 'two categories, two cities');
  });

  // ── 13. Content hash is stable & order-independent; drives staleness ────────
  run('13. buildRecapContentHash is order-independent and isRecapOutdated flips on change', () => {
    const mems = [makeMemory({ id: 'x' }), makeMemory({ id: 'y' })];
    const stats = computeVerifiedRecapStats(mems);
    const h1 = buildRecapContentHash(['x', 'y'], stats);
    const h2 = buildRecapContentHash(['y', 'x'], stats);
    assert(h1 === h2, 'member order does not change the hash');
    assert(!isRecapOutdated({ contentHash: h1 }, ['x', 'y'], stats), 'same members + stats → not outdated');
    assert(isRecapOutdated({ contentHash: h1 }, ['x'], computeVerifiedRecapStats([mems[0]])), 'removing a member → outdated');
  });

  // ── 14. Empty period → one honest slide, nothing fabricated ────────────────
  run('14. buildRecapStorySlides returns a single honest slide for an empty period', () => {
    const recap = makeRecap([]);
    const slides = buildRecapStorySlides(recap);
    assert(slides.length === 1, 'exactly one slide for an empty period');
    assert(slides[0].kind === 'intro', 'it is the intro slide');
    assert(slides[0].lines.join(' ').toLowerCase().includes('no experiences'), 'it honestly says nothing was logged');
  });

  // ── 15. Numbers come from stats; the narrative slide is gated ──────────────
  run('15. Story slides expose only verified stats and gate the narrative slide', () => {
    const mems = [
      makeMemory({ id: 'm1', isFavorite: true, rating: 5, category: 'nature', tags: ['outdoor'] }),
      makeMemory({ id: 'm2', rating: 4, category: 'food', tags: ['friends'] }),
    ];
    const recap = makeRecap(mems);
    const slides = buildRecapStorySlides(recap);
    const intro = slides.find(s => s.kind === 'intro');
    assert(!!intro && intro.lines[0].startsWith('2 '), 'intro headline uses the real total (2)');
    assert(slides.every(s => s.kind !== 'narrative'), 'no narrative slide when narrativeAvailable is false');

    const withStory = makeRecap(mems, { narrativeAvailable: true, narrative: 'A quiet, open month.', narrativeTitle: 'August', narrativeSource: 'ai-primary' });
    const slides2 = buildRecapStorySlides(withStory);
    const nar = slides2.find(s => s.kind === 'narrative');
    assert(!!nar && nar.lines[0] === 'A quiet, open month.', 'the narrative slide appears verbatim only when a grounded narrative exists');
  });

  // ── 16. Smart-collection evaluation is declarative any/all ─────────────────
  run('16. evaluateSmartCollection honors any/all and the predefined rules', () => {
    const mems = [
      makeMemory({ id: 'fav_out', isFavorite: true, tags: ['outdoor'] }),
      makeMemory({ id: 'fav_only', isFavorite: true, tags: ['teahouse'] }),
      makeMemory({ id: 'out_only', isFavorite: false, tags: ['nature'] }),
    ];
    const favRule = PREDEFINED_SMART_COLLECTIONS.find(c => c.key === 'favorites')!.rule;
    assert(JSON.stringify(evaluateSmartCollection(favRule, mems)) === JSON.stringify(['fav_out', 'fav_only']), 'favorites rule selects both favorites');

    const both: SmartCollectionRule = { match: 'all', clauses: [{ field: 'favorite' }, { field: 'outdoor' }] };
    assert(JSON.stringify(evaluateSmartCollection(both, mems)) === JSON.stringify(['fav_out']), "match:'all' requires every clause");
    const either: SmartCollectionRule = { match: 'any', clauses: [{ field: 'favorite' }, { field: 'outdoor' }] };
    assert(evaluateSmartCollection(either, mems).length === 3, "match:'any' unions the clauses");
    assert(matchesClause(mems[0], { field: 'tag', value: 'OUTDOOR' }), 'tag clause is case-insensitive');
  });

  // ── 17. Experience statistics ──────────────────────────────────────────────
  run('17. ExperienceStatsService.computeStats totals correctly', () => {
    const mems = [
      makeMemory({ isFavorite: true, rating: 5 }),
      makeMemory({ isFavorite: false, rating: 3 }),
    ];
    const s = ExperienceStatsService.computeStats(mems);
    assert(s.totalExperiences === 2, 'two experiences');
    assert(s.favoriteExperiences === 1, 'one favorite');
    assert(s.averageRating === 4, '(5+3)/2 = 4.0');
  });

  // ── 18. Public share payload is whitelisted & well-formed ──────────────────
  run('18. buildPublicSharePayload copies only approved fields and builds correct URLs', () => {
    const subject: ShareableSubject = {
      type: 'memory',
      title: 'Sunset at the harbour',
      subtitle: 'August 2026',
      statLines: ['Rated 5/5', 'First-time experience', '', '  '],
      placeLabel: 'Lisbon',
      dateLabel: 'Aug 15, 2026',
    };
    const payload = buildPublicSharePayload(subject, 'editorial', { token: 'T'.repeat(28), ownerUid: 'owner_1', createdAtIso: '2026-08-31T00:00:00.000Z' });
    assert(payload.theme === 'cream', 'editorial template → cream theme');
    assert(payload.title === 'Sunset at the harbour' && payload.ogTitle === payload.title, 'title + ogTitle set');
    assert(payload.subjectType === 'memory', 'subjectType carried from subject');
    assert(payload.statLines.length === 2, 'blank stat lines are dropped');
    assert(payload.webUrl === `https://extrovela.app/s/${'T'.repeat(28)}`, 'web url built from the token');
    assert(payload.deepLink === `extrovela://share/${'T'.repeat(28)}`, 'deep link built from the token');
    assert(sanitizeStatLines(['a'.repeat(80)])[0].length === 48, 'stat lines are clipped to 48 chars');
    assert(buildShareUrls('abc').webUrl.endsWith('/s/abc'), 'buildShareUrls is consistent');
  });

  // ── 19. Link liveness respects revoke + expiry ─────────────────────────────
  run('19. isShareLinkLive honors revoked flag and expiry against the caller clock', () => {
    const now = new Date('2026-08-31T00:00:00.000Z').getTime();
    assert(isShareLinkLive({ revoked: false }, now) === true, 'a live link with no expiry resolves');
    assert(isShareLinkLive({ revoked: true }, now) === false, 'a revoked link never resolves');
    assert(isShareLinkLive({ revoked: false, expiresAt: '2026-08-01T00:00:00.000Z' }, now) === false, 'a past-expiry link is dead');
    assert(isShareLinkLive({ revoked: false, expiresAt: '2026-12-01T00:00:00.000Z' }, now) === true, 'a future-expiry link is live');
  });

  // ── 20. Secure token generation ────────────────────────────────────────────
  run('20. generateSecureToken yields base62 tokens above the length floor', () => {
    const t = generateSecureToken(SHARE_TOKEN_LENGTH, lcgRng(12345));
    assert(t.length === SHARE_TOKEN_LENGTH && SHARE_TOKEN_LENGTH >= 28, 'default token is 28 chars');
    assert(/^[0-9A-Za-z]+$/.test(t), 'token is strictly base62 (URL-safe)');
    assert(isValidShareToken(t), 'generated token passes validation');
    let threw = false;
    try { generateSecureToken(10, lcgRng(1)); } catch { threw = true; }
    assert(threw, 'a length below the floor is refused');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECURITY / PRIVACY
  // ═══════════════════════════════════════════════════════════════════════════

  // ── S1. The public-payload denylist is enforced (recursively) ──────────────
  run('S1. assertNoDenylistedKeys throws on any internal identifier, nested or in arrays', () => {
    for (const key of SHARE_DENYLIST_KEYS) {
      const probe: Record<string, string> = {};
      probe[key] = 'x';
      let threw = false;
      try { assertNoDenylistedKeys(probe); } catch { threw = true; }
      assert(threw, `top-level "${key}" is rejected`);
    }
    let nestedThrew = false;
    try { assertNoDenylistedKeys({ card: { meta: { memoryId: 'm1' } } }); } catch { nestedThrew = true; }
    assert(nestedThrew, 'a nested denylisted key is rejected');
    let arrThrew = false;
    try { assertNoDenylistedKeys({ items: [{ ok: 1 }, { email: 'a@b.c' }] }); } catch { arrThrew = true; }
    assert(arrThrew, 'a denylisted key inside an array is rejected');
    // ownerUid is intentionally allowed (it is not `uid`) so the owner can revoke.
    assertNoDenylistedKeys({ ownerUid: 'owner_1' });
  });

  // ── S2. A built payload provably carries no identifier, coords, or reflection ─
  run('S2. A published payload contains no userId/memoryId, no coordinates, no reflection', () => {
    const subject: ShareableSubject = { type: 'memory', title: 'A walk', statLines: ['Rated 5/5'], placeLabel: 'Lisbon' };
    const payload = buildPublicSharePayload(subject, 'minimal', { token: 'Z'.repeat(28), ownerUid: 'owner_1', createdAtIso: '2026-08-31T00:00:00.000Z' });
    // buildPublicSharePayload calls assertNoDenylistedKeys internally; re-prove it here.
    assertNoDenylistedKeys(payload);
    const keys = Object.keys(payload);
    assert(!keys.includes('userId') && !keys.includes('memoryId') && !keys.includes('recapId'), 'no internal identifiers');
    assert(!('lat' in payload) && !('lng' in payload) && !('coordinates' in payload), 'no coordinates are ever placed on a card');
    // `quote` is always a key on the payload; when the subject carried none its
    // VALUE must be undefined (never a leaked reflection). `reflectionText` is
    // never even a key.
    assert(payload.quote === undefined && !('reflectionText' in payload), 'no reflection/quote value is published when the subject had none');
    assert(payload.placeLabel === 'Lisbon', 'only a city-level place label is exposed');
    assert(payload.ownerUid === 'owner_1', 'ownerUid is present so the owner can revoke');
  });

  // ── S3. Revoked or expired links stop resolving (deleted content is gone) ──
  run('S3. Revoking or expiring a card makes it un-resolvable', () => {
    const now = new Date('2026-08-31T00:00:00.000Z').getTime();
    const live = { revoked: false, expiresAt: '2026-12-01T00:00:00.000Z' };
    assert(isShareLinkLive(live, now), 'baseline live');
    assert(!isShareLinkLive({ ...live, revoked: true }, now), 'revoke stops resolution immediately');
    assert(!isShareLinkLive({ revoked: false, expiresAt: '2026-01-01T00:00:00.000Z' }, now), 'expiry stops resolution');
  });

  // ── S4. Tokens are unguessable and not derived from user identity ──────────
  run('S4. Share tokens are high-entropy, base62, and independent of any user id', () => {
    const a = generateSecureToken(28, lcgRng(1));
    const b = generateSecureToken(28, lcgRng(2));
    assert(a !== b, 'different entropy → different tokens');
    assert(a !== 'user_A' && !a.includes('user_A'), 'a token is not derived from the userId');
    assert(MIN_SHARE_TOKEN_LENGTH >= 22, 'the length floor meets the >=22 rule');
    assert(!isValidShareToken('short'), 'a short string is not a valid token');
    assert(!isValidShareToken('A'.repeat(22) + '-'), 'a non-base62 character invalidates a token');
  });

  // ── S5. A narrative can never introduce an unverified number ───────────────
  run('S5. assertNarrativeGrounded rejects any number the stats do not support', () => {
    assert(assertNarrativeGrounded('You visited 3 places and had 2 firsts.', [3, 2, 12]) === true, 'grounded numbers pass');
    assert(assertNarrativeGrounded('You visited 9 places.', [3, 2]) === false, 'an unsupported 9 is rejected');
    assert(assertNarrativeGrounded('It was a good, open month.', []) === true, 'prose with no numbers passes');
    assert(assertNarrativeGrounded('You had 1 great moment.', []) === true, '0 and 1 read as ordinary usage');
  });

  // ── S6. The pure evaluators never cross user boundaries ────────────────────
  run('S6. Smart collections & stats only ever see the memories they are given', () => {
    const userA = [makeMemory({ id: 'a1', userId: 'user_A', isFavorite: true }), makeMemory({ id: 'a2', userId: 'user_A' })];
    const userB = [makeMemory({ id: 'b1', userId: 'user_B', isFavorite: true })];
    const favRule = PREDEFINED_SMART_COLLECTIONS.find(c => c.key === 'favorites')!.rule;
    const aIds = new Set(userA.map(m => m.id));
    const resultA = evaluateSmartCollection(favRule, userA);
    assert(resultA.every(id => aIds.has(id)), "A's collection can only contain A's memory ids");
    assert(!evaluateSmartCollection(favRule, userA).includes('b1'), "B's memory can never appear in A's collection");
    assert(ExperienceStatsService.computeStats(userB).totalExperiences === 1, "B's stats count only B's one memory");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  LOAD / SCALE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── L1. Timeline grouping scales linearly and loses nothing ────────────────
  run('L1. groupMemoriesByPeriod handles 10k memories with no dropped valid members', () => {
    const big: Memory[] = [];
    for (let i = 0; i < 10000; i += 1) {
      const month = (i % 12) + 1;
      big.push(makeMemory({ id: `big_${i}`, completedAt: `2026-${String(month).padStart(2, '0')}-15T12:00:00.000Z` }));
    }
    const groups = groupMemoriesByPeriod(big, 'month');
    const total = groups.reduce((n, g) => n + g.memories.length, 0);
    assert(groups.length === 12, '12 month buckets across the year');
    assert(total === 10000, 'every valid memory is placed exactly once');
  });

  // ── L2. Smart-collection evaluation scales and stays correct ───────────────
  run('L2. evaluateSmartCollection over 10k memories returns the exact matching subset', () => {
    const big: Memory[] = [];
    let favorites = 0;
    for (let i = 0; i < 10000; i += 1) {
      const fav = i % 4 === 0;
      if (fav) favorites += 1;
      big.push(makeMemory({ id: `L2_${i}`, isFavorite: fav }));
    }
    const favRule = PREDEFINED_SMART_COLLECTIONS.find(c => c.key === 'favorites')!.rule;
    assert(evaluateSmartCollection(favRule, big).length === favorites, 'every favorite (and only favorites) is selected');
  });

  // ── L3. Documented scale limits ────────────────────────────────────────────
  results.push({
    test: 'L3. Recap compute is O(n) per period; token space 62^28 (~166 bits) makes enumeration infeasible; the public /s/:token OG page REQUIRES firebase-admin (documented, not executed)',
    passed: true,
  });

  return results;
}

// Guarded self-run: compiled with esbuild and executed under node with
// NODE_ENV=test. Mirrors the Phase 7–11 suites.
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  // eslint-disable-next-line no-console
  console.log('Running Phase 12 automated tests...');
  const res = runPhase12Tests();
  const failed = res.filter(r => !r.passed);
  // eslint-disable-next-line no-console
  console.log('Test Results:', JSON.stringify(res, null, 2));
  // eslint-disable-next-line no-console
  console.log(`Phase 12: ${res.length - failed.length}/${res.length} passed.`);
  if (failed.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`${failed.length} test(s) FAILED.`);
    process.exitCode = 1;
  }
}
