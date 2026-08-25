/**
 * EXTROVELA — Phase 11: Hallucination Guard
 *
 * The single rule this module enforces:
 *
 *   THE MODEL MAY NOT INTRODUCE A REAL-WORLD FACT.
 *
 * Places, opening hours, clock times, prices, distances, weather and events are
 * all supplied by the Context Engine (Places / Weather / Events providers). The
 * model composes language around those facts; it never sources them. Anything
 * the model asserts that isn't on the supplied allow-list is stripped or the
 * whole response is rejected.
 *
 * This is what stops a poetic quest from confidently sending someone to a
 * teahouse that does not exist, or telling them sunset is at 6:40 when it isn't.
 */

/** Patterns that indicate the model invented a concrete real-world fact. */
const CLOCK_TIME = /\b(?:[01]?\d|2[0-3])[:.][0-5]\d\s*(?:am|pm)?\b/i;
const BARE_HOUR_WITH_MERIDIEM = /\b(?:1[0-2]|0?[1-9])\s*(?:am|pm)\b/i;
const PRICE = /(?:npr|rs\.?|₹|\$|€|£)\s*\d|(?:\d+\s*(?:rupees|dollars|euros))/i;
const DISTANCE = /\b\d+(?:\.\d+)?\s*(?:km|kilometers?|kilometres?|miles?|mi)\b/i;
const OPENING_HOURS = /\b(?:opens?|closes?|closing|open)\s+(?:at|from|until|till)\b/i;
const PHONE = /\b(?:\+?\d[\d\s-]{7,}\d)\b/;
const URL = /\bhttps?:\/\/|\bwww\./i;

/** Words that assert a factual guarantee the model cannot possibly verify. */
const UNVERIFIABLE_CLAIMS = [
  'guaranteed',
  'always open',
  'never crowded',
  'free entry',
  'no entrance fee',
  'wheelchair accessible',
  'award-winning',
  'the best in',
  'voted best',
  'michelin',
];

/** Statements about the user's inner life that we do not permit. See Phase 11 privacy rules. */
const EMOTIONAL_CLAIMS = [
  'you became happier',
  'you were happier',
  'you seemed sad',
  'you seem depressed',
  'your mental health',
  'you are anxious',
  'you were lonely',
  'you have been struggling',
  'this healed you',
  'you overcame your',
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds the fact allow-list from Context Engine output. ONLY these values may
 * appear in AI text as concrete facts.
 */
export function buildFactAllowList(context = {}) {
  const placeNames = (context.places || [])
    .map(p => p?.name)
    .filter(Boolean)
    .map(String);

  const areaNames = [context.city, context.district, context.neighborhood]
    .filter(Boolean)
    .map(String);

  const allowedTimes = [context.sunsetTime, context.sunriseTime, context.goldenHourStart]
    .filter(Boolean)
    .map(String);

  const eventTitles = (context.events || [])
    .map(e => e?.title)
    .filter(Boolean)
    .map(String);

  return {
    placeNames,
    areaNames,
    allowedTimes,
    eventTitles,
    normalizedPlaces: placeNames.map(normalize),
    normalizedAreas: areaNames.map(normalize),
    normalizedEvents: eventTitles.map(normalize),
  };
}

/**
 * Checks a single text field. Returns a list of violation codes.
 * `allowList` comes from buildFactAllowList().
 */
export function findViolations(text, allowList) {
  const violations = [];
  if (typeof text !== 'string' || !text) return violations;

  const lower = text.toLowerCase();

  // 1. Invented clock times, unless the exact string was supplied to us.
  const timeMatch = text.match(CLOCK_TIME) || text.match(BARE_HOUR_WITH_MERIDIEM);
  if (timeMatch) {
    const supplied = allowList.allowedTimes.some(t =>
      lower.includes(String(t).toLowerCase())
    );
    if (!supplied) violations.push('invented_time');
  }

  // 2. Invented prices, distances, hours, contact details.
  if (PRICE.test(text)) violations.push('invented_price');
  if (DISTANCE.test(text)) violations.push('invented_distance');
  if (OPENING_HOURS.test(text)) violations.push('invented_opening_hours');
  if (PHONE.test(text)) violations.push('invented_contact_detail');
  if (URL.test(text)) violations.push('invented_url');

  // 3. Unverifiable factual guarantees.
  for (const claim of UNVERIFIABLE_CLAIMS) {
    if (lower.includes(claim)) {
      violations.push('unverifiable_claim');
      break;
    }
  }

  // 4. Claims about the user's emotional or mental state.
  for (const claim of EMOTIONAL_CLAIMS) {
    if (lower.includes(claim)) {
      violations.push('emotional_claim');
      break;
    }
  }

  return violations;
}

/**
 * Verifies a place reference against the allow-list.
 * Returns { allowed, matchedName } — matchedName is the canonical supplied name.
 */
export function verifyPlaceReference(placeName, allowList) {
  if (!placeName) return { allowed: true, matchedName: null };

  const needle = normalize(placeName);
  if (!needle) return { allowed: true, matchedName: null };

  const idx = allowList.normalizedPlaces.indexOf(needle);
  if (idx >= 0) return { allowed: true, matchedName: allowList.placeNames[idx] };

  // Areas (city/district) are acceptable — they came from reverse geocoding.
  const areaIdx = allowList.normalizedAreas.indexOf(needle);
  if (areaIdx >= 0) return { allowed: true, matchedName: allowList.areaNames[areaIdx] };

  // A supplied place name containing the reference (or vice versa) is accepted,
  // because models often shorten "Patan Durbar Square" to "Durbar Square".
  const partial = allowList.normalizedPlaces.findIndex(
    p => p.includes(needle) || needle.includes(p)
  );
  if (partial >= 0) return { allowed: true, matchedName: allowList.placeNames[partial] };

  return { allowed: false, matchedName: null };
}

/**
 * Validates a complete AI quest object against the fact allow-list.
 *
 * Returns { safe, violations, sanitized }.
 * `sanitized` has unverifiable place references removed so a partially-good
 * response can still be used rather than discarded entirely.
 */
export function guardQuest(quest, context) {
  const allowList = buildFactAllowList(context);
  const violations = [];

  for (const field of ['title', 'description', 'whyThisQuest']) {
    for (const v of findViolations(quest[field], allowList)) {
      violations.push(`${field}:${v}`);
    }
  }

  for (const [i, step] of (quest.steps || []).entries()) {
    for (const v of findViolations(step, allowList)) {
      violations.push(`steps[${i}]:${v}`);
    }
  }

  const sanitized = { ...quest };

  if (quest.suggestedPlaceName) {
    const check = verifyPlaceReference(quest.suggestedPlaceName, allowList);
    if (!check.allowed) {
      violations.push('suggestedPlaceName:place_not_in_context');
      delete sanitized.suggestedPlaceName;
    } else if (check.matchedName) {
      // Snap to the canonical name we actually hold.
      sanitized.suggestedPlaceName = check.matchedName;
    }
  }

  // A response containing an invented time, price, distance or emotional claim
  // is rejected outright — those cannot be safely stripped from prose.
  const fatal = violations.some(v =>
    /invented_time|invented_price|invented_distance|invented_opening_hours|invented_contact_detail|invented_url|emotional_claim/.test(
      v
    )
  );

  return { safe: !fatal, violations, sanitized };
}

/**
 * Validates a recap narrative against the supplied statistics.
 * The model may only restate numbers we gave it.
 */
export function guardRecapStory(story, suppliedFacts = {}) {
  const violations = [];
  if (typeof story !== 'string' || !story) {
    return { safe: false, violations: ['empty_story'] };
  }

  const lower = story.toLowerCase();

  for (const claim of EMOTIONAL_CLAIMS) {
    if (lower.includes(claim)) {
      violations.push('emotional_claim');
      break;
    }
  }

  // Every integer in the narrative must be one we supplied.
  const suppliedNumbers = new Set(
    Object.values(suppliedFacts)
      .filter(v => typeof v === 'number' && Number.isFinite(v))
      .map(v => String(Math.round(v)))
  );
  // Years and month names are allowed because periodStart/periodEnd are supplied.
  const numbers = story.match(/\b\d{1,4}\b/g) || [];
  for (const raw of numbers) {
    if (suppliedNumbers.has(raw)) continue;
    if (/^(19|20)\d{2}$/.test(raw)) continue; // a year
    violations.push('unsupported_number');
    break;
  }

  // Quotation marks imply a quote from the user, which we never fabricate.
  if (/["“”][^"“”]{10,}["“”]/.test(story)) {
    violations.push('fabricated_quote');
  }

  return { safe: violations.length === 0, violations };
}

export default {
  buildFactAllowList,
  findViolations,
  verifyPlaceReference,
  guardQuest,
  guardRecapStory,
};
