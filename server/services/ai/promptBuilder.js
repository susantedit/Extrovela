/**
 * EXTROVELA — Phase 11: Prompt Builder
 *
 * Builds SMALL, BOUNDED, SINGLE-USER prompts. Explicitly not a "giant lifetime
 * context" prompt.
 *
 * Hard rules enforced here:
 *  1. ONE USER PER PROMPT. Every builder takes exactly one personalization
 *     bundle and asserts its userId. There is no code path that concatenates two
 *     users' contexts.
 *  2. BOUNDED SIZE. Memory statements, recent categories and place lists are all
 *     truncated to hard caps before interpolation, so prompt cost cannot grow
 *     with account age.
 *  3. NO RAW REFLECTIONS. Reflection text never enters a prompt. Only structured
 *     derived statements do.
 *  4. NO IDENTIFIERS. No userId, email, display name, document id or storage
 *     path is interpolated into prompt text.
 *  5. FACTS ARE SUPPLIED, NOT REQUESTED. The prompt lists the real-world facts
 *     the model may use and instructs it to invent none.
 */

const LIMITS = {
  memoryStatements: 8,
  memoryStatementChars: 160,
  recentCategories: 6,
  places: 6,
  events: 4,
  preferredCategories: 5,
  exclusions: 8,
  totalPromptChars: 6000,
};

/** Strips anything that looks like an identifier or a coordinate. */
function sanitizeForPrompt(text) {
  if (typeof text !== 'string') return '';
  return text
    // Firestore-ish and uid-ish tokens
    .replace(/\b[a-zA-Z0-9_-]{20,}\b/g, '[redacted]')
    // email addresses
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[redacted]')
    // decimal coordinates
    .replace(/-?\d{1,3}\.\d{4,}/g, '[redacted]')
    // storage paths
    .replace(/users\/[^\s]+/gi, '[redacted]')
    .slice(0, 400)
    .trim();
}

function bullet(items, cap) {
  return items
    .filter(Boolean)
    .slice(0, cap)
    .map(item => `- ${sanitizeForPrompt(String(item))}`)
    .join('\n');
}

/**
 * Asserts the bundle belongs to exactly one user and that it is the user we were
 * asked about. Throws rather than silently building a cross-user prompt.
 */
export function assertSingleUserContext(userId, personalization) {
  if (!userId) throw new Error('promptBuilder: userId is required');
  if (!personalization) return;
  if (personalization.userId && personalization.userId !== userId) {
    throw new Error(
      'promptBuilder: personalization bundle belongs to a different user — refusing to build prompt'
    );
  }
}

/** The shared preamble. Kept short: it is prepended to every request. */
const SYSTEM_RULES = `You are the experience-writing engine for EXTROVELA, a real-world quest app.

ABSOLUTE RULES:
1. Use ONLY the real-world facts listed under "VERIFIED FACTS". Invent no place, no address, no clock time, no price, no distance, no opening hours, no phone number, no URL, no event.
2. If you need a fact that is not listed, write the experience so it does not require that fact.
3. Never state or imply anything about the person's emotions, mental health, medical status, religion, politics, ethnicity, sexual orientation, or finances.
4. Never claim an experience made someone happier, calmer, or better. Describe the experience, not the person's inner life.
5. Never invent a quotation.
6. Respect every stated limit and exclusion. They are non-negotiable.
7. Output valid JSON matching the requested schema. No prose outside the JSON.`;

/**
 * Renders the personalization block. Returns '' when there is nothing to say,
 * which is the correct behaviour for a cold-start user.
 */
function renderPersonalization(personalization) {
  if (!personalization || !personalization.enabled) return '';

  const sections = [];

  const statements = (personalization.memoryStatements || [])
    .map(s => sanitizeForPrompt(s).slice(0, LIMITS.memoryStatementChars))
    .filter(Boolean);
  if (statements.length > 0) {
    sections.push(`WHAT WE HAVE LEARNED (derived, may be imperfect):\n${bullet(statements, LIMITS.memoryStatements)}`);
  }

  const soft = personalization.softPreferences || {};
  const softLines = [];
  if ((soft.preferredCategories || []).length) {
    softLines.push(
      `Leans toward: ${soft.preferredCategories.slice(0, LIMITS.preferredCategories).join(', ')}`
    );
  }
  if (soft.preferredSocialMode && soft.preferredSocialMode !== 'unknown') {
    softLines.push(`Usual social mode: ${soft.preferredSocialMode}`);
  }
  if (soft.preferredIndoorOutdoor && soft.preferredIndoorOutdoor !== 'unknown') {
    softLines.push(`Usual setting: ${soft.preferredIndoorOutdoor}`);
  }
  if (soft.preferredPace) softLines.push(`Usual pace: ${soft.preferredPace}`);
  if (softLines.length) {
    sections.push(`SOFT PREFERENCES (may be relaxed if nothing fits):\n${bullet(softLines, 6)}`);
  }

  const recent = personalization.recentCategories || [];
  if (recent.length) {
    sections.push(
      `RECENTLY DONE (avoid repeating these):\n${bullet(recent, LIMITS.recentCategories)}`
    );
  }

  const novelty = personalization.novelty;
  if (novelty) {
    const instruction =
      novelty.level === 'comfortable'
        ? 'Stay close to what this person already enjoys.'
        : novelty.level === 'stretch'
          ? 'Offer a mild stretch: adjacent to their taste but not identical to it.'
          : 'Offer something genuinely new to them, while still respecting every limit and exclusion below.';
    sections.push(`NOVELTY TARGET: ${novelty.level} — ${instruction}`);
  }

  if (personalization.surprise && personalization.surprise.value) {
    sections.push(
      `SURPRISE DIRECTION: build the experience around "${sanitizeForPrompt(personalization.surprise.value)}".`
    );
  }

  return sections.join('\n\n');
}

/** Renders the non-negotiable limits block. */
function renderConstraints(constraints = {}) {
  const lines = [];
  if (constraints.maxDurationMinutes) {
    lines.push(`Must fit within ${constraints.maxDurationMinutes} minutes total.`);
  }
  if (constraints.maxBudgetNpr !== undefined && constraints.maxBudgetNpr !== null) {
    lines.push(`Must cost no more than NPR ${constraints.maxBudgetNpr}. Do not name a price in the text.`);
  }
  if (constraints.maxDistanceMeters) {
    lines.push(`Must stay within roughly ${Math.round(constraints.maxDistanceMeters / 100) * 100} metres of the starting area. Do not state a distance in the text.`);
  }
  if (constraints.requireIndoor) lines.push('Must be indoors.');
  if (constraints.requireDaylight) lines.push('Must be doable in daylight.');
  if ((constraints.exclusions || []).length) {
    lines.push(
      `MUST NOT involve: ${constraints.exclusions.slice(0, LIMITS.exclusions).join(', ')}.`
    );
  }
  if ((constraints.accessibilityNeeds || []).length) {
    lines.push(
      `Must accommodate: ${constraints.accessibilityNeeds.slice(0, 6).join(', ')}. Avoid stairs, steep ground and long walks unless explicitly fine.`
    );
  }

  if (lines.length === 0) return '';
  return `NON-NEGOTIABLE LIMITS:\n${bullet(lines, 10)}`;
}

/** Renders the verified-facts block: the ONLY real-world facts the model may use. */
function renderVerifiedFacts(context = {}) {
  const sections = [];

  const areaLines = [];
  if (context.city) areaLines.push(`City: ${context.city}`);
  if (context.district) areaLines.push(`District: ${context.district}`);
  if (context.season) areaLines.push(`Season: ${context.season}`);
  if (context.timeOfDay) areaLines.push(`Time of day: ${context.timeOfDay}`);
  if (context.dayOfWeek) areaLines.push(`Day: ${context.dayOfWeek}`);
  if (areaLines.length) sections.push(bullet(areaLines, 6));

  if (context.weather) {
    const w = context.weather;
    const weatherLines = [
      w.condition ? `Weather: ${w.condition}` : null,
      typeof w.temperatureCelsius === 'number' ? `Temperature band: ${Math.round(w.temperatureCelsius / 5) * 5}°C` : null,
      typeof w.precipitationProbability === 'number' ? `Chance of rain: ${Math.round(w.precipitationProbability)}%` : null,
      w.sunsetTime ? `Sunset time (you MAY state this exactly): ${w.sunsetTime}` : null,
      w.isGoldenHour ? 'Golden hour is active now.' : null,
    ].filter(Boolean);
    if (weatherLines.length) sections.push(bullet(weatherLines, 6));
  }

  const places = (context.places || []).slice(0, LIMITS.places);
  if (places.length) {
    sections.push(
      `Places you MAY reference by name (and no others):\n${bullet(places.map(p => p.name), LIMITS.places)}`
    );
  } else {
    sections.push('No verified places available. Write the experience without naming a specific venue.');
  }

  const events = (context.events || []).slice(0, LIMITS.events);
  if (events.length) {
    sections.push(
      `Verified events happening now:\n${bullet(events.map(e => e.title), LIMITS.events)}`
    );
  }

  return `VERIFIED FACTS:\n${sections.join('\n\n')}`;
}

function assemble(parts) {
  const prompt = parts.filter(Boolean).join('\n\n');
  if (prompt.length <= LIMITS.totalPromptChars) return prompt;
  // Truncate from the personalization section rather than dropping rules or facts.
  return `${prompt.slice(0, LIMITS.totalPromptChars)}\n\n[context truncated for cost control]`;
}

/**
 * Quest generation prompt. Routed to the STRONG model (complex generation).
 */
export function buildQuestGenerationPrompt({ userId, personalization, constraints, context, request }) {
  assertSingleUserContext(userId, personalization);

  const requestLines = [
    request?.availableTimeMinutes ? `Available time: ${request.availableTimeMinutes} minutes` : null,
    request?.energy ? `Energy: ${request.energy}` : null,
    request?.mood ? `Desired mood: ${request.mood}` : null,
    request?.socialPreference ? `Social preference: ${request.socialPreference}` : null,
    request?.environmentPreference ? `Environment: ${request.environmentPreference}` : null,
    request?.requestedCategory ? `Requested theme: ${request.requestedCategory}` : null,
  ].filter(Boolean);

  return assemble([
    SYSTEM_RULES,
    `TASK: Write 1 real-world experience for one person, right now.`,
    requestLines.length ? `THIS REQUEST:\n${bullet(requestLines, 8)}` : null,
    renderConstraints(constraints),
    renderVerifiedFacts(context),
    renderPersonalization(personalization),
    `OUTPUT JSON:
{
  "title": "4-9 word evocative title",
  "description": "2-4 sentences describing exactly what to do",
  "category": "one of: Mindfulness, Exploration, Connection, Creativity, Nature",
  "steps": ["short instruction", "short instruction"],
  "estimatedMinutes": 45,
  "whyThisQuest": "one sentence referencing only the verified facts above",
  "tags": ["tag", "tag"],
  "suggestedPlaceName": "exact name from the verified places list, or omit"
}`,
  ]);
}

/**
 * Classification / extraction prompt. Routed to the CHEAP model.
 * Used for things like "which category is this quest", not for generation.
 */
export function buildClassificationPrompt({ instruction, input, allowedLabels = [] }) {
  return assemble([
    'You are a strict classifier. Output valid JSON only. Do not explain.',
    `TASK: ${sanitizeForPrompt(instruction)}`,
    allowedLabels.length ? `ALLOWED LABELS (choose exactly one):\n${bullet(allowedLabels, 30)}` : null,
    `INPUT:\n${sanitizeForPrompt(String(input)).slice(0, 800)}`,
    `OUTPUT JSON: { "label": "one allowed label", "confidence": 0.0-1.0, "reason": "under 20 words" }`,
  ]);
}

/**
 * Recap narrative prompt (Phase 12). Routed to the STRONG model.
 *
 * Every number the model may use is enumerated. The guard rejects any number
 * that is not in this list.
 */
export function buildRecapPrompt({ userId, periodLabel, statistics, highlights, places, firsts }) {
  assertSingleUserContext(userId, null);

  const statLines = Object.entries(statistics || {})
    .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
    .slice(0, 14)
    .map(([k, v]) => `${k}: ${v}`);

  return assemble([
    SYSTEM_RULES,
    `TASK: Write a short, warm, factual recap of one person's ${sanitizeForPrompt(periodLabel)}.`,
    `ABSOLUTE RECAP RULES:
- Use ONLY the numbers listed under VERIFIED STATISTICS. Do not compute, estimate, round or invent any other number.
- Do not claim the person felt anything. Do not claim they changed, grew, healed, or became happier.
- Do not invent a place, a date, or an event.
- Do not quote the person.
- If the statistics are sparse, write a shorter recap. Do not pad it with invention.`,
    statLines.length ? `VERIFIED STATISTICS:\n${bullet(statLines, 14)}` : 'VERIFIED STATISTICS: none available.',
    (places || []).length ? `PLACES VISITED (you may name these):\n${bullet(places, 8)}` : null,
    (firsts || []).length ? `FIRST-TIME EXPERIENCES:\n${bullet(firsts, 6)}` : null,
    (highlights || []).length ? `MEMORY TITLES (you may reference these):\n${bullet(highlights, 8)}` : null,
    `OUTPUT JSON:
{
  "title": "short title for this period",
  "story": "3-6 sentences, factual, second person",
  "highlights": ["one line per notable fact, each traceable to a statistic above"]
}`,
  ]);
}

/** Memory title suggestions (Phase 12). Routed to the CHEAP model. */
export function buildMemoryTitlePrompt({ questTitle, category, placeName, tags, mood }) {
  const facts = [
    questTitle ? `Experience: ${questTitle}` : null,
    category ? `Category: ${category}` : null,
    placeName ? `Place: ${placeName}` : null,
    (tags || []).length ? `Tags: ${tags.slice(0, 6).join(', ')}` : null,
    mood ? `Mood the person selected: ${mood}` : null,
  ].filter(Boolean);

  return assemble([
    'You suggest short titles for a personal journal entry. Output valid JSON only.',
    `RULES:
- Use only the facts listed. Invent no place, time, price or detail.
- Do not describe how the person felt beyond the mood they explicitly selected.
- 3 to 8 words per title. No quotation marks.`,
    `FACTS:\n${bullet(facts, 6)}`,
    `OUTPUT JSON: { "titles": ["title one", "title two", "title three"] }`,
  ]);
}

export { LIMITS as PROMPT_LIMITS, sanitizeForPrompt };

export default {
  buildQuestGenerationPrompt,
  buildClassificationPrompt,
  buildRecapPrompt,
  buildMemoryTitlePrompt,
  assertSingleUserContext,
  sanitizeForPrompt,
  PROMPT_LIMITS: LIMITS,
};
