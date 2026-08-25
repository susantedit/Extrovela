/**
 * EXTROVELA — Phase 11: Deterministic Provider
 *
 * The last link in the AI fallback chain. When the primary model fails, the
 * fallback model fails, and validation rejects everything, this provider
 * produces a real, usable result with NO model call at all.
 *
 * It is deterministic by design:
 *  - Same inputs → same output. No Math.random(), no clock reads.
 *  - Composes text ONLY from facts supplied by the Context Engine.
 *  - Produces no narrative claim it cannot substantiate.
 *
 * This is why the app never shows a broken AI feature: the floor is a template,
 * not an error state. It is also honest — templated output is labelled
 * source: 'deterministic' so callers and analytics can tell the difference.
 */

/** Stable, non-random index selection derived from a seed string. */
function hashIndex(seed, length) {
  if (length <= 0) return 0;
  let hash = 0;
  const text = String(seed || 'extrovela');
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
}

const TITLE_TEMPLATES = {
  Nature: ['A Slow Walk Through Green', 'Find the Quietest Tree', 'Follow the Open Air'],
  Mindfulness: ['Ten Minutes of Nothing', 'Sit Still and Notice', 'One Breath at a Time'],
  Exploration: ['Take the Street You Skip', 'One Turn You Never Take', 'Walk Until It Changes'],
  Connection: ['Say One Real Thing', 'Share the Ordinary', 'A Conversation Without a Phone'],
  Creativity: ['Make One Small Thing', 'Notice, Then Draw It', 'Collect Five Details'],
};

const STEP_TEMPLATES = {
  Nature: [
    'Head toward the nearest open or green space.',
    'Put your phone away for the walk out.',
    'Stop once and stay still for two full minutes.',
  ],
  Mindfulness: [
    'Find somewhere you can sit without being rushed.',
    'Leave your phone in your pocket, screen down.',
    'Notice five things you can hear before you leave.',
  ],
  Exploration: [
    'Pick a direction you do not usually walk in.',
    'Keep going until the surroundings feel unfamiliar.',
    'Turn back only once something has surprised you.',
  ],
  Connection: [
    'Choose one person you have not properly spoken to this week.',
    'Meet them somewhere without a screen between you.',
    'Ask one question you do not already know the answer to.',
  ],
  Creativity: [
    'Take something small to write or draw with.',
    'Find a spot where you can stay ten minutes.',
    'Record one detail nobody else would notice.',
  ],
};

const CATEGORY_FALLBACK = 'Exploration';

function normalizeCategory(category) {
  if (!category) return CATEGORY_FALLBACK;
  const match = Object.keys(TITLE_TEMPLATES).find(
    key => key.toLowerCase() === String(category).toLowerCase()
  );
  return match || CATEGORY_FALLBACK;
}

/**
 * Builds the description from verified facts only. Every clause is conditional
 * on a fact actually being present, so nothing is asserted without a source.
 */
function buildDescription({ category, place, weather, timeOfDay, minutes }) {
  const parts = [];

  if (place) {
    parts.push(`Make your way to ${place}.`);
  } else {
    parts.push('Start from wherever you are now.');
  }

  const categoryLine = {
    Nature: 'Give yourself room to walk without a destination in mind.',
    Mindfulness: 'The point is to stop doing things for a while, not to achieve anything.',
    Exploration: 'The aim is unfamiliarity, not distance.',
    Connection: 'Keep it simple — presence matters more than the plan.',
    Creativity: 'Nothing you make here has to be good.',
  }[category];
  if (categoryLine) parts.push(categoryLine);

  if (weather?.isGoldenHour) {
    parts.push('The light is low right now, which is the best part of the day for this.');
  } else if (weather?.condition === 'rain') {
    parts.push('It is wet out, so pick somewhere with cover if you need it.');
  } else if (weather?.condition === 'clear' && timeOfDay === 'evening') {
    parts.push('The sky is clear this evening.');
  }

  if (minutes) {
    parts.push(`Give it about ${minutes} minutes.`);
  }

  return parts.join(' ');
}

export class DeterministicProvider {
  constructor() {
    this.name = 'deterministic';
  }

  isAvailable() {
    return true; // always
  }

  /**
   * Produces a quest from templates + verified facts.
   * `seed` makes selection stable per request (pass the fingerprint or questId).
   */
  generateQuest({ context = {}, request = {}, personalization = null, seed = 'default' } = {}) {
    const preferred =
      personalization?.softPreferences?.preferredCategories?.[0] ||
      request.requestedCategory ||
      null;
    const category = normalizeCategory(preferred);

    const titles = TITLE_TEMPLATES[category];
    const title = titles[hashIndex(seed, titles.length)];

    const place = (context.places || [])[0]?.name || null;
    const minutes = request.availableTimeMinutes || null;

    const description = buildDescription({
      category,
      place,
      weather: context.weather,
      timeOfDay: context.timeOfDay,
      minutes,
    });

    // "Why this quest" states only what we actually know.
    const whyParts = [];
    if (minutes) whyParts.push(`fits your ${minutes} minutes`);
    if (context.weather?.isGoldenHour) whyParts.push('golden hour is happening now');
    else if (context.weather?.condition) whyParts.push(`suits ${context.weather.condition} weather`);
    if (place) whyParts.push(`${place} is nearby`);

    const whyThisQuest =
      whyParts.length > 0
        ? `Chosen because it ${whyParts.join(', and ')}.`
        : 'A simple starting point that works in most conditions.';

    return {
      title,
      description,
      category,
      steps: STEP_TEMPLATES[category].slice(0, minutes && minutes <= 30 ? 2 : 3),
      estimatedMinutes: minutes || 45,
      whyThisQuest,
      tags: [category.toLowerCase(), 'offline-safe'],
      ...(place ? { suggestedPlaceName: place } : {}),
    };
  }

  /**
   * Structured recap with NO narrative. Phase 12 renders these statistics
   * directly rather than fabricating a story when AI is unavailable.
   *
   * Returning story: null is deliberate. A fabricated fallback narrative would
   * be indistinguishable from a real one to the user, which is exactly what the
   * factual-grounding rule forbids.
   */
  generateRecap({ statistics = {}, places = [], firsts = [], periodLabel = 'this period' } = {}) {
    const highlights = [];

    if (typeof statistics.totalExperiences === 'number' && statistics.totalExperiences > 0) {
      highlights.push(
        `${statistics.totalExperiences} ${statistics.totalExperiences === 1 ? 'experience' : 'experiences'} in ${periodLabel}`
      );
    }
    // Accept both spellings: Phase 12 VerifiedRecapStats uses `newPlaces`/`firstTimes`,
    // while the legacy server stats builder (routes/api.js) emits `newPlacesCount`/
    // `firstTimeCount`. Reading both keeps this floor correct for either caller.
    const newPlaces = typeof statistics.newPlaces === 'number' ? statistics.newPlaces : statistics.newPlacesCount;
    const firstTimes = typeof statistics.firstTimes === 'number' ? statistics.firstTimes : statistics.firstTimeCount;
    if (typeof newPlaces === 'number' && newPlaces > 0) {
      highlights.push(`${newPlaces} new ${newPlaces === 1 ? 'place' : 'places'}`);
    }
    if (typeof firstTimes === 'number' && firstTimes > 0) {
      highlights.push(`${firstTimes} first-${firstTimes === 1 ? 'time' : 'times'}`);
    }
    if (places.length > 0) {
      highlights.push(`Visited ${places.slice(0, 3).join(', ')}`);
    }
    if (firsts.length > 0) {
      highlights.push(`First time: ${firsts.slice(0, 2).join(', ')}`);
    }

    return {
      title: `Your ${periodLabel}`,
      // Explicitly null: no narrative is generated without a model.
      story: null,
      highlights,
      narrativeAvailable: false,
    };
  }

  /** Title suggestions built only from supplied facts. */
  generateMemoryTitles({ questTitle, placeName, category, mood } = {}) {
    const titles = [];

    if (questTitle) titles.push(String(questTitle).slice(0, 70));
    if (placeName && category) titles.push(`${category} at ${placeName}`.slice(0, 70));
    else if (placeName) titles.push(`That time at ${placeName}`.slice(0, 70));
    if (mood && category) titles.push(`A ${String(mood).toLowerCase()} ${String(category).toLowerCase()}`.slice(0, 70));
    if (category) titles.push(String(category).slice(0, 70));

    const unique = [...new Set(titles.filter(Boolean))];
    return { titles: unique.length > 0 ? unique.slice(0, 3) : ['Untitled memory'] };
  }

  /** Deterministic classifier: keyword overlap against the allowed labels. */
  classify({ input, allowedLabels = [] } = {}) {
    if (allowedLabels.length === 0) {
      return { label: 'unknown', confidence: 0, reason: 'no allowed labels supplied' };
    }

    const haystack = String(input || '').toLowerCase();
    let best = { label: allowedLabels[0], score: 0 };

    for (const label of allowedLabels) {
      const needle = String(label).toLowerCase();
      const score = haystack.includes(needle) ? needle.length : 0;
      if (score > best.score) best = { label, score };
    }

    return {
      label: best.label,
      // Low confidence by design: this is a keyword match, not understanding.
      confidence: best.score > 0 ? 0.4 : 0.1,
      reason: best.score > 0 ? 'keyword match' : 'no match, defaulted',
    };
  }
}

export const deterministicProvider = new DeterministicProvider();
export default deterministicProvider;
