/**
 * EXTROVELA — Phase 11: User Preference Parser
 *
 * Turns a short natural-language statement the user typed ("I hate crowds",
 * "no alcohol please", "I prefer mornings") into structured
 * ParsedUserPreference records.
 *
 * Design decisions:
 *  - DETERMINISTIC, NOT AI. Parsing runs entirely on-device with a keyword
 *    lexicon. No LLM call, no network, no cost, no hallucination surface.
 *  - Results carry source='userExplicit', which outranks every inferred signal
 *    and never decays.
 *  - Sensitive attributes are REJECTED, not stored. If a user types something
 *    about religion, health, politics, etc., we drop it and tell them why.
 *  - Unrecognized text becomes kind='unrecognized' rather than a guess. We do
 *    not invent a preference we cannot justify.
 */

import logger from '../../utils/logger';
import { scanForSensitiveContent, describeSensitiveRejection } from './sensitiveAttributeGuard';
import { preferenceSignalService } from './preferenceSignalService';
import { personalizationSettingsService } from './personalizationSettingsService';
import type {
  HardConstraints,
  ParsedUserPreference,
  PreferenceDimension,
} from '../../types/experienceIntelligence';

/** Phrases that signal a HARD exclusion rather than a soft dislike. */
const HARD_EXCLUSION_MARKERS = [
  'never',
  'no ',
  'not able',
  "can't",
  'cannot',
  'avoid entirely',
  'allergic',
  'absolutely not',
];

const NEGATIVE_MARKERS = [
  'hate',
  'dislike',
  'avoid',
  "don't like",
  'dont like',
  'do not like',
  'not into',
  'rather not',
  'too many',
  'too much',
  'no ',
  'never',
];

const POSITIVE_MARKERS = [
  'love',
  'like',
  'prefer',
  'enjoy',
  'into',
  'more of',
  'want more',
  'favourite',
  'favorite',
];

const ACCESSIBILITY_MARKERS = [
  'wheelchair',
  'mobility',
  'walking stick',
  'cane',
  'crutches',
  'step-free',
  'step free',
  'stairs',
  'hard of hearing',
  'low vision',
  'blind',
  'deaf',
];

/**
 * Dimension lexicon. Keys are matched as whole words/phrases against the input.
 * Values are the canonical dimension value we store.
 */
const LEXICON: Array<{ terms: string[]; dimension: PreferenceDimension; value: string }> = [
  // socialMode
  { terms: ['crowd', 'crowds', 'crowded', 'busy places', 'packed'], dimension: 'socialMode', value: 'group' },
  { terms: ['alone', 'solo', 'by myself', 'on my own'], dimension: 'socialMode', value: 'solo' },
  { terms: ['with friends', 'friends', 'group'], dimension: 'socialMode', value: 'friend' },
  { terms: ['strangers', 'meet people', 'meeting people', 'new people'], dimension: 'socialMode', value: 'strangers' },

  // indoorOutdoor / environment
  { terms: ['outdoor', 'outdoors', 'outside', 'open air'], dimension: 'indoorOutdoor', value: 'outdoor' },
  { terms: ['indoor', 'indoors', 'inside'], dimension: 'indoorOutdoor', value: 'indoor' },

  // timeOfDay
  { terms: ['early morning', 'sunrise', 'dawn'], dimension: 'timeOfDay', value: 'earlyMorning' },
  { terms: ['morning', 'mornings'], dimension: 'timeOfDay', value: 'morning' },
  { terms: ['afternoon', 'afternoons', 'midday'], dimension: 'timeOfDay', value: 'afternoon' },
  { terms: ['evening', 'evenings', 'sunset', 'golden hour'], dimension: 'timeOfDay', value: 'evening' },
  { terms: ['night', 'nights', 'after dark'], dimension: 'timeOfDay', value: 'night' },
  { terms: ['late night', 'very late'], dimension: 'timeOfDay', value: 'lateNight' },

  // budget
  { terms: ['free', 'no cost', 'costs nothing', 'zero cost'], dimension: 'budget', value: 'free' },
  { terms: ['cheap', 'budget', 'inexpensive', 'affordable'], dimension: 'budget', value: 'low' },
  { terms: ['expensive', 'pricey', 'costly', 'splurge', 'treat'], dimension: 'budget', value: 'treat' },

  // duration / pace
  { terms: ['quick', 'short', 'brief', 'half an hour', '30 minutes'], dimension: 'duration', value: 'short' },
  { terms: ['long', 'all day', 'full day', 'several hours'], dimension: 'duration', value: 'long' },
  { terms: ['slow', 'relaxed', 'unhurried', 'take my time'], dimension: 'pace', value: 'slow' },
  { terms: ['fast', 'brisk', 'active', 'energetic'], dimension: 'pace', value: 'brisk' },

  // distance
  { terms: ['nearby', 'close by', 'walking distance', 'near me'], dimension: 'distance', value: 'near' },
  { terms: ['far', 'road trip', 'out of town', 'day trip'], dimension: 'distance', value: 'far' },

  // weather
  { terms: ['rain', 'rainy', 'wet weather'], dimension: 'weatherPreference', value: 'rain' },
  { terms: ['sunny', 'sunshine', 'clear skies'], dimension: 'weatherPreference', value: 'clear' },
  { terms: ['heat', 'hot weather', 'too hot'], dimension: 'weatherPreference', value: 'hot' },
  { terms: ['cold', 'chilly'], dimension: 'weatherPreference', value: 'cold' },

  // categories (aligned with the app's quest categories)
  { terms: ['nature', 'green space', 'parks', 'park'], dimension: 'category', value: 'nature' },
  { terms: ['food', 'eating', 'restaurants', 'street food'], dimension: 'category', value: 'food' },
  { terms: ['culture', 'museum', 'museums', 'gallery', 'galleries', 'heritage'], dimension: 'category', value: 'culture' },
  { terms: ['creative', 'art', 'making things', 'crafts'], dimension: 'category', value: 'creative' },
  { terms: ['adventure', 'adrenaline', 'thrill'], dimension: 'category', value: 'adventure' },
  { terms: ['wellness', 'meditation', 'yoga', 'stillness'], dimension: 'category', value: 'wellness' },
  { terms: ['social', 'community', 'events'], dimension: 'category', value: 'social' },
  { terms: ['learning', 'workshop', 'class', 'skill'], dimension: 'category', value: 'learning' },
  { terms: ['walking', 'walk', 'stroll', 'wander'], dimension: 'category', value: 'walking' },
  { terms: ['photography', 'photos', 'taking pictures'], dimension: 'category', value: 'photography' },
  { terms: ['music', 'live music', 'concert', 'gig'], dimension: 'category', value: 'music' },
  { terms: ['water', 'river', 'lake', 'swimming'], dimension: 'category', value: 'water' },

  // exclusion-style values that are not a dimension value per se
  { terms: ['alcohol', 'drinking', 'bars', 'bar'], dimension: 'setting', value: 'alcohol' },
  { terms: ['hiking', 'hike', 'trek', 'trekking', 'climbing'], dimension: 'category', value: 'hiking' },
];

function containsAny(haystack: string, needles: string[]): string | null {
  for (const needle of needles) {
    if (haystack.includes(needle)) return needle;
  }
  return null;
}

/** Splits a multi-clause statement into individually-parseable fragments. */
export function splitClauses(text: string): string[] {
  return text
    .split(/[,;.]|\band\b|\bbut\b|\balso\b/i)
    .map(part => part.trim())
    .filter(part => part.length > 1);
}

/**
 * Parses one clause. Pure and synchronous so the whole lexicon is unit-testable
 * without any I/O.
 */
export function parseClause(clause: string): ParsedUserPreference {
  const original = clause.trim();
  const lower = ` ${original.toLowerCase()} `;

  // 1. Sensitive-attribute gate comes FIRST. We never store this, even if the
  //    rest of the clause is parseable.
  const scan = scanForSensitiveContent(original);
  if (scan.isSensitive) {
    return {
      kind: 'unrecognized',
      direction: 0,
      originalText: original,
      rejectedReason: describeSensitiveRejection(scan),
    };
  }

  // 2. Accessibility needs are their own kind and always treated as hard.
  const accessibility = containsAny(lower, ACCESSIBILITY_MARKERS);
  if (accessibility) {
    return {
      kind: 'accessibility',
      direction: 0,
      value: accessibility.trim(),
      originalText: original,
    };
  }

  // 3. Direction.
  const negative = containsAny(lower, NEGATIVE_MARKERS);
  const positive = containsAny(lower, POSITIVE_MARKERS);
  // Negation wins when both appear ("I like quiet, no crowds").
  const direction: 1 | -1 | 0 = negative ? -1 : positive ? 1 : 0;

  // 4. Dimension + value. Longest matching term wins so "early morning" beats "morning".
  let best: { dimension: PreferenceDimension; value: string; termLength: number } | null = null;
  for (const entry of LEXICON) {
    for (const term of entry.terms) {
      if (!lower.includes(term)) continue;
      if (!best || term.length > best.termLength) {
        best = { dimension: entry.dimension, value: entry.value, termLength: term.length };
      }
    }
  }

  if (!best) {
    return { kind: 'unrecognized', direction, originalText: original };
  }

  // 5. Hard vs soft.
  const isHard = direction === -1 && containsAny(lower, HARD_EXCLUSION_MARKERS) !== null;

  return {
    kind: isHard ? 'hardExclusion' : 'softPreference',
    dimension: best.dimension,
    value: best.value,
    direction: direction === 0 ? 1 : direction,
    originalText: original,
  };
}

export function parsePreferenceText(text: string): ParsedUserPreference[] {
  if (!text || !text.trim()) return [];
  const clauses = splitClauses(text);
  const source = clauses.length > 0 ? clauses : [text];

  const parsed = source.map(parseClause);

  // Deduplicate on dimension+value, keeping the strongest (hard beats soft).
  const seen = new Map<string, ParsedUserPreference>();
  const unmatched: ParsedUserPreference[] = [];

  for (const item of parsed) {
    if (!item.dimension || !item.value) {
      unmatched.push(item);
      continue;
    }
    const key = `${item.dimension}:${item.value}`;
    const existing = seen.get(key);
    if (!existing || (item.kind === 'hardExclusion' && existing.kind !== 'hardExclusion')) {
      seen.set(key, item);
    }
  }

  return [...seen.values(), ...unmatched];
}

/** Projects parsed hard exclusions and accessibility needs into HardConstraints. */
export function toHardConstraints(
  parsed: ParsedUserPreference[],
  base: HardConstraints = { exclusions: [], accessibilityNeeds: [] }
): HardConstraints {
  const exclusions = new Set(base.exclusions);
  const accessibilityNeeds = new Set(base.accessibilityNeeds);

  for (const item of parsed) {
    if (item.kind === 'hardExclusion' && item.value) exclusions.add(item.value);
    if (item.kind === 'accessibility' && item.value) accessibilityNeeds.add(item.value);
  }

  return {
    ...base,
    exclusions: Array.from(exclusions),
    accessibilityNeeds: Array.from(accessibilityNeeds),
  };
}

export class UserPreferenceParser {
  /**
   * Parses the text and persists each recognized preference as an explicit,
   * user-corrected signal. Explicit signals are set server-side to
   * source='userExplicit' with confidence 1 and never decay.
   */
  async applyPreferenceText(
    userId: string,
    text: string
  ): Promise<{
    applied: ParsedUserPreference[];
    rejected: ParsedUserPreference[];
    unrecognized: ParsedUserPreference[];
    constraints: HardConstraints;
  }> {
    const parsed = parsePreferenceText(text);

    const rejected = parsed.filter(p => p.rejectedReason);
    const unrecognized = parsed.filter(p => !p.rejectedReason && p.kind === 'unrecognized');
    const actionable = parsed.filter(
      p => !p.rejectedReason && p.kind !== 'unrecognized' && p.dimension && p.value
    );

    const settings = await personalizationSettingsService.getSettings(userId);
    const applied: ParsedUserPreference[] = [];

    // Explicit user statements are honoured even when inference is off — the user
    // asked for this directly. But with the master switch off we store nothing.
    if (settings.aiPersonalizationEnabled) {
      for (const item of actionable) {
        if (!item.dimension || !item.value) continue;
        // Hard exclusions are strongly negative; soft preferences follow direction.
        const strength = item.kind === 'hardExclusion' ? -1 : item.direction;
        await preferenceSignalService.correctSignal(userId, item.dimension, item.value, strength);
        applied.push(item);
      }
    }

    logger.debug('Parsed explicit user preferences', {
      appliedCount: applied.length,
      rejectedCount: rejected.length,
      unrecognizedCount: unrecognized.length,
    });

    return {
      applied,
      rejected,
      unrecognized,
      constraints: toHardConstraints(parsed),
    };
  }
}

export const userPreferenceParser = new UserPreferenceParser();
export default userPreferenceParser;
