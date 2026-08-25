/**
 * EXTROVELA — Phase 11: Model Router
 *
 * Routes each AI task to the cheapest model that can do it well:
 *
 *   CHEAP  — classification, extraction, tagging, short title suggestions.
 *            High volume, low stakes, easily validated.
 *   STRONG — quest generation, recap narratives.
 *            Low volume, user-visible prose, worth the cost.
 *
 * Model IDs are configuration, not code. Override with GEMINI_MODEL_CHEAP /
 * GEMINI_MODEL_STRONG so a model upgrade needs no code change.
 */

export const TASK_TIERS = {
  // cheap tier
  classify: 'cheap',
  extractTags: 'cheap',
  memoryTitle: 'cheap',
  categorize: 'cheap',
  // strong tier
  generateQuest: 'strong',
  recapStory: 'strong',
};

/** Conservative defaults. gemini-1.5-flash is already the app's working model. */
const DEFAULTS = {
  cheap: 'gemini-1.5-flash-8b',
  strong: 'gemini-1.5-flash',
};

/**
 * Per-tier generation settings. Cheap tasks get low temperature (we want the
 * same answer every time); prose gets a little room.
 */
const TIER_CONFIG = {
  cheap: { temperature: 0.1, maxOutputTokens: 512 },
  strong: { temperature: 0.75, maxOutputTokens: 1600 },
};

export function tierForTask(task) {
  return TASK_TIERS[task] || 'strong';
}

export function modelForTier(tier) {
  if (tier === 'cheap') {
    return process.env.GEMINI_MODEL_CHEAP || DEFAULTS.cheap;
  }
  return process.env.GEMINI_MODEL_STRONG || DEFAULTS.strong;
}

/**
 * The fallback model for a tier. A strong-tier failure falls back to the cheap
 * model (degraded but real) before falling back to deterministic output.
 */
export function fallbackModelForTier(tier) {
  if (tier === 'strong') return modelForTier('cheap');
  return null;
}

export function routeTask(task) {
  const tier = tierForTask(task);
  return {
    task,
    tier,
    primaryModel: modelForTier(tier),
    fallbackModel: fallbackModelForTier(tier),
    ...TIER_CONFIG[tier],
  };
}

export default { routeTask, tierForTask, modelForTier, fallbackModelForTier, TASK_TIERS };
