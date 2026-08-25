/**
 * EXTROVELA — Phase 11: AI Provider Orchestrator
 *
 * The single entry point for every AI task. Implements the full chain:
 *
 *   1. PRIMARY MODEL   (routed by task tier)
 *        ↓ fail / invalid schema / hallucination detected
 *   2. FALLBACK MODEL  (cheaper model, same task)
 *        ↓ fail / invalid schema / hallucination detected
 *   3. DETERMINISTIC   (templates + verified facts, no model call)
 *
 * Every layer runs the same two gates:
 *   - schemaValidator: is the JSON the right shape?
 *   - hallucinationGuard: did the model invent a real-world fact?
 *
 * A response that fails either gate is discarded, not repaired. The result
 * always reports which layer produced it, so nothing is ever presented as
 * AI-generated when it was templated.
 */

import { geminiProvider } from './geminiProvider.js';
import { deterministicProvider } from './deterministicProvider.js';
import { routeTask } from './modelRouter.js';
import {
  validateAiJson,
  AI_QUEST_SCHEMA,
  AI_CLASSIFICATION_SCHEMA,
  AI_RECAP_SCHEMA,
  AI_MEMORY_TITLE_SCHEMA,
} from './schemaValidator.js';
import { guardQuest, guardRecapStory } from './hallucinationGuard.js';
import {
  buildQuestGenerationPrompt,
  buildClassificationPrompt,
  buildRecapPrompt,
  buildMemoryTitlePrompt,
  assertSingleUserContext,
} from './promptBuilder.js';

/** Which layer produced the result. Surfaced to callers and analytics. */
export const RESULT_SOURCE = {
  PRIMARY: 'ai-primary',
  FALLBACK: 'ai-fallback',
  DETERMINISTIC: 'deterministic',
};

/**
 * Lightweight in-process telemetry. Counts only — no prompts, no user content,
 * no ids. Exposed via /api/intelligence/ai-health for operational visibility.
 */
const stats = {
  attempts: 0,
  primarySuccess: 0,
  fallbackSuccess: 0,
  deterministicUsed: 0,
  schemaRejections: 0,
  hallucinationRejections: 0,
  providerErrors: {},
};

function noteError(code) {
  stats.providerErrors[code] = (stats.providerErrors[code] || 0) + 1;
}

export function getAiStats() {
  return JSON.parse(JSON.stringify(stats));
}

export function resetAiStats() {
  stats.attempts = 0;
  stats.primarySuccess = 0;
  stats.fallbackSuccess = 0;
  stats.deterministicUsed = 0;
  stats.schemaRejections = 0;
  stats.hallucinationRejections = 0;
  stats.providerErrors = {};
}

/**
 * Runs one model attempt through both gates.
 * Returns { ok, data, rejection } — rejection explains which gate failed.
 */
async function attempt({ prompt, model, temperature, maxOutputTokens, schema, schemaOptions, guard }) {
  const raw = await geminiProvider.complete({ prompt, model, temperature, maxOutputTokens });

  if (!raw.ok) {
    noteError(raw.error || 'unknown_provider_error');
    return { ok: false, data: null, rejection: raw.error, retryable: raw.retryable };
  }

  const validation = validateAiJson(raw.text, schema, schemaOptions);
  if (!validation.valid) {
    stats.schemaRejections += 1;
    return {
      ok: false,
      data: null,
      rejection: `schema_invalid:${validation.errors.slice(0, 3).join('|')}`,
    };
  }

  if (guard) {
    const guarded = guard(validation.data);
    if (!guarded.safe) {
      stats.hallucinationRejections += 1;
      return {
        ok: false,
        data: null,
        rejection: `hallucination:${guarded.violations.slice(0, 3).join('|')}`,
      };
    }
    return { ok: true, data: guarded.data, rejection: null, violations: guarded.violations };
  }

  return { ok: true, data: validation.data, rejection: null };
}

export class AIProviderOrchestrator {
  /**
   * Generates one personalized quest.
   *
   * @param {object} params
   * @param {string} params.userId              — exactly one user per call
   * @param {object} params.context             — Context Engine output (verified facts)
   * @param {object} params.request             — this request's parameters
   * @param {object} [params.personalization]   — bounded personalization bundle
   * @param {object} [params.constraints]       — hard constraints (never relaxed)
   */
  async generateQuest({ userId, context = {}, request = {}, personalization = null, constraints = {} }) {
    // Refuses to build a prompt mixing two users' contexts.
    assertSingleUserContext(userId, personalization);

    stats.attempts += 1;
    const route = routeTask('generateQuest');
    const prompt = buildQuestGenerationPrompt({
      userId,
      personalization,
      constraints,
      context,
      request,
    });

    const guard = data => {
      const result = guardQuest(data, context);
      return { safe: result.safe, violations: result.violations, data: result.sanitized };
    };

    const attemptOptions = {
      prompt,
      temperature: route.temperature,
      maxOutputTokens: route.maxOutputTokens,
      schema: AI_QUEST_SCHEMA,
      schemaOptions: { allowUnknown: false },
      guard,
    };

    const rejections = [];

    // 1. Primary model.
    const primary = await attempt({ ...attemptOptions, model: route.primaryModel });
    if (primary.ok) {
      stats.primarySuccess += 1;
      return {
        success: true,
        source: RESULT_SOURCE.PRIMARY,
        model: route.primaryModel,
        quest: primary.data,
        warnings: primary.violations || [],
      };
    }
    rejections.push({ layer: 'primary', model: route.primaryModel, reason: primary.rejection });

    // 2. Fallback model.
    if (route.fallbackModel) {
      const fallback = await attempt({ ...attemptOptions, model: route.fallbackModel });
      if (fallback.ok) {
        stats.fallbackSuccess += 1;
        return {
          success: true,
          source: RESULT_SOURCE.FALLBACK,
          model: route.fallbackModel,
          quest: fallback.data,
          warnings: fallback.violations || [],
        };
      }
      rejections.push({ layer: 'fallback', model: route.fallbackModel, reason: fallback.rejection });
    }

    // 3. Deterministic floor — always succeeds, never invents a fact.
    stats.deterministicUsed += 1;
    const seed = `${request.requestedCategory || ''}:${request.availableTimeMinutes || ''}:${context.city || ''}`;
    const quest = deterministicProvider.generateQuest({ context, request, personalization, seed });

    return {
      success: true,
      source: RESULT_SOURCE.DETERMINISTIC,
      model: null,
      quest,
      rejections,
    };
  }

  /**
   * Generates a recap narrative for Phase 12.
   *
   * On total AI failure the result carries story: null and
   * narrativeAvailable: false. The caller MUST render statistics without prose
   * rather than substituting a fabricated narrative.
   */
  async generateRecapStory({ userId, periodLabel, statistics = {}, highlights = [], places = [], firsts = [] }) {
    assertSingleUserContext(userId, null);

    stats.attempts += 1;
    const route = routeTask('recapStory');
    const prompt = buildRecapPrompt({ userId, periodLabel, statistics, highlights, places, firsts });

    // Numbers the model is permitted to restate: the supplied statistics, plus
    // the counts of the supplied lists.
    const suppliedFacts = {
      ...statistics,
      placeCount: places.length,
      firstsCount: firsts.length,
      highlightCount: highlights.length,
    };

    const guard = data => {
      const storyCheck = guardRecapStory(data.story, suppliedFacts);
      const violations = [...storyCheck.violations];

      // Highlights are held to the same standard as the story.
      const cleanHighlights = (data.highlights || []).filter(line => {
        const check = guardRecapStory(line, suppliedFacts);
        if (!check.safe) violations.push(`highlight:${check.violations[0]}`);
        return check.safe;
      });

      return {
        safe: storyCheck.safe,
        violations,
        data: { ...data, highlights: cleanHighlights },
      };
    };

    const attemptOptions = {
      prompt,
      temperature: route.temperature,
      maxOutputTokens: route.maxOutputTokens,
      schema: AI_RECAP_SCHEMA,
      schemaOptions: { allowUnknown: false },
      guard,
    };

    const rejections = [];

    const primary = await attempt({ ...attemptOptions, model: route.primaryModel });
    if (primary.ok) {
      stats.primarySuccess += 1;
      return {
        success: true,
        source: RESULT_SOURCE.PRIMARY,
        model: route.primaryModel,
        narrativeAvailable: true,
        ...primary.data,
      };
    }
    rejections.push({ layer: 'primary', model: route.primaryModel, reason: primary.rejection });

    if (route.fallbackModel) {
      const fallback = await attempt({ ...attemptOptions, model: route.fallbackModel });
      if (fallback.ok) {
        stats.fallbackSuccess += 1;
        return {
          success: true,
          source: RESULT_SOURCE.FALLBACK,
          model: route.fallbackModel,
          narrativeAvailable: true,
          ...fallback.data,
        };
      }
      rejections.push({ layer: 'fallback', model: route.fallbackModel, reason: fallback.rejection });
    }

    // Structured statistics only. No fabricated narrative.
    stats.deterministicUsed += 1;
    const structured = deterministicProvider.generateRecap({
      statistics,
      places,
      firsts,
      periodLabel,
    });

    return {
      success: true,
      source: RESULT_SOURCE.DETERMINISTIC,
      model: null,
      ...structured,
      rejections,
    };
  }

  /** Short memory-title suggestions. Cheap tier. */
  async suggestMemoryTitles({ questTitle, category, placeName, tags = [], mood }) {
    stats.attempts += 1;
    const route = routeTask('memoryTitle');
    const prompt = buildMemoryTitlePrompt({ questTitle, category, placeName, tags, mood });

    const allowedPlaces = placeName ? [{ name: placeName }] : [];
    const guard = data => {
      const violations = [];
      const clean = (data.titles || []).filter(title => {
        const check = guardQuest({ title, description: 'x'.repeat(20), category: category || 'Exploration' }, {
          places: allowedPlaces,
        });
        if (!check.safe) violations.push(`title:${check.violations[0]}`);
        return check.safe;
      });
      return {
        safe: clean.length > 0,
        violations,
        data: { titles: clean },
      };
    };

    const attemptOptions = {
      prompt,
      temperature: route.temperature,
      maxOutputTokens: route.maxOutputTokens,
      schema: AI_MEMORY_TITLE_SCHEMA,
      schemaOptions: { allowUnknown: false },
      guard,
    };

    const primary = await attempt({ ...attemptOptions, model: route.primaryModel });
    if (primary.ok) {
      stats.primarySuccess += 1;
      return { success: true, source: RESULT_SOURCE.PRIMARY, ...primary.data };
    }

    if (route.fallbackModel) {
      const fallback = await attempt({ ...attemptOptions, model: route.fallbackModel });
      if (fallback.ok) {
        stats.fallbackSuccess += 1;
        return { success: true, source: RESULT_SOURCE.FALLBACK, ...fallback.data };
      }
    }

    stats.deterministicUsed += 1;
    return {
      success: true,
      source: RESULT_SOURCE.DETERMINISTIC,
      ...deterministicProvider.generateMemoryTitles({ questTitle, placeName, category, mood }),
    };
  }

  /** Constrained classification. Cheap tier. */
  async classify({ instruction, input, allowedLabels = [] }) {
    stats.attempts += 1;
    const route = routeTask('classify');
    const prompt = buildClassificationPrompt({ instruction, input, allowedLabels });

    const guard = data => {
      // A label outside the allow-list is a hallucination by definition.
      if (allowedLabels.length > 0 && !allowedLabels.includes(data.label)) {
        return { safe: false, violations: ['label_not_in_allowed_set'], data };
      }
      return { safe: true, violations: [], data };
    };

    const attemptOptions = {
      prompt,
      temperature: route.temperature,
      maxOutputTokens: route.maxOutputTokens,
      schema: AI_CLASSIFICATION_SCHEMA,
      schemaOptions: { allowUnknown: false },
      guard,
    };

    const primary = await attempt({ ...attemptOptions, model: route.primaryModel });
    if (primary.ok) {
      stats.primarySuccess += 1;
      return { success: true, source: RESULT_SOURCE.PRIMARY, ...primary.data };
    }

    stats.deterministicUsed += 1;
    return {
      success: true,
      source: RESULT_SOURCE.DETERMINISTIC,
      ...deterministicProvider.classify({ input, allowedLabels }),
    };
  }

  /** Operational health, safe to expose to an authenticated admin. */
  health() {
    return {
      geminiConfigured: geminiProvider.isAvailable(),
      deterministicAvailable: true,
      routing: {
        generateQuest: routeTask('generateQuest'),
        recapStory: routeTask('recapStory'),
        classify: routeTask('classify'),
        memoryTitle: routeTask('memoryTitle'),
      },
      stats: getAiStats(),
    };
  }
}

export const aiProvider = new AIProviderOrchestrator();
export default aiProvider;
