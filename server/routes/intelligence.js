/**
 * EXTROVELA — Phase 11: Intelligence Routes
 *
 * Server-side AI endpoints. All model keys stay here; the mobile bundle never
 * sees one.
 *
 * The client sends its OWN bounded personalization bundle (derived on-device
 * from the user's own Firestore subcollections). The server:
 *   1. verifies the caller's identity (see requireIdentity.js for its real,
 *      documented limits),
 *   2. re-validates and re-bounds the bundle — a client cannot inflate prompt
 *      size or smuggle raw text through it,
 *   3. builds a single-user prompt,
 *   4. runs primary → fallback → deterministic with schema + hallucination gates.
 *
 * Note what the server does NOT do: it never fetches one user's personalization
 * while serving another. There is no code path in this file that reads a userId
 * other than req.auth.userId.
 */

import express from 'express';
import { aiProvider } from '../services/ai/aiProvider.js';
import { deleteUserAccountData, buildDeletionManifest } from '../services/accountDeletionService.js';
import { requireIdentity, enforceSelfOnly } from '../middleware/requireIdentity.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { getCachedQuests, setCachedQuests } from '../middleware/costProtection.js';
import { validateCoordinates } from '../middleware/validator.js';

const router = express.Router();

/** Hard server-side caps. The client's numbers are suggestions; these are law. */
const CAPS = {
  memoryStatements: 8,
  memoryStatementChars: 160,
  recentCategories: 6,
  preferredCategories: 5,
  exclusions: 8,
  accessibilityNeeds: 6,
  places: 6,
  events: 4,
  placeNameChars: 120,
  freeTextChars: 200,
};

const ALLOWED_SOCIAL = ['solo', 'friend', 'group', 'strangers', 'unknown'];
const ALLOWED_INDOOR_OUTDOOR = ['indoor', 'outdoor', 'mixed', 'unknown'];
const ALLOWED_TIME_OF_DAY = ['earlyMorning', 'morning', 'afternoon', 'evening', 'night', 'lateNight'];
const ALLOWED_PACE = ['slow', 'moderate', 'brisk'];
const ALLOWED_NOVELTY = ['comfortable', 'stretch', 'surprise'];
const ALLOWED_WEATHER = ['clear', 'cloudy', 'rain', 'storm', 'snow', 'mist'];

/** Anything that looks like precise coordinates must not reach a prompt. */
const COORDINATE_PATTERN = /-?\d{1,3}\.\d{4,}/;

function cleanString(value, maxChars) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (COORDINATE_PATTERN.test(trimmed)) return undefined;
  return trimmed.slice(0, maxChars);
}

function cleanStringArray(value, maxItems, maxChars) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => cleanString(item, maxChars))
    .filter(Boolean)
    .slice(0, maxItems);
}

function pickEnum(value, allowed) {
  return typeof value === 'string' && allowed.includes(value) ? value : undefined;
}

function clampInt(value, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Rebuilds the personalization bundle from scratch, keeping only fields we
 * recognise. Unknown keys are dropped rather than forwarded — that is what stops
 * a client from injecting free text into the prompt.
 */
function sanitizePersonalization(raw, authenticatedUserId) {
  if (!raw || typeof raw !== 'object') return null;

  // Refuse a bundle that claims to belong to somebody else.
  if (raw.userId && raw.userId !== authenticatedUserId) {
    return { __rejected: 'cross_user_bundle' };
  }

  const soft = raw.softPreferences && typeof raw.softPreferences === 'object' ? raw.softPreferences : {};
  const novelty = raw.novelty && typeof raw.novelty === 'object' ? raw.novelty : {};
  const surprise = raw.surprise && typeof raw.surprise === 'object' ? raw.surprise : null;

  const level = pickEnum(novelty.level, ALLOWED_NOVELTY) || 'comfortable';
  const targetScore =
    typeof novelty.targetScore === 'number' && novelty.targetScore >= 0 && novelty.targetScore <= 1
      ? novelty.targetScore
      : { comfortable: 0.2, stretch: 0.5, surprise: 0.8 }[level];

  return {
    userId: authenticatedUserId,
    enabled: raw.enabled === true,
    memoryStatements: cleanStringArray(
      raw.memoryStatements,
      CAPS.memoryStatements,
      CAPS.memoryStatementChars
    ),
    recentCategories: cleanStringArray(raw.recentCategories, CAPS.recentCategories, 40),
    softPreferences: {
      preferredCategories: cleanStringArray(soft.preferredCategories, CAPS.preferredCategories, 40),
      preferredSocialMode: pickEnum(soft.preferredSocialMode, ALLOWED_SOCIAL),
      preferredIndoorOutdoor: pickEnum(soft.preferredIndoorOutdoor, ALLOWED_INDOOR_OUTDOOR),
      preferredTimeOfDay: pickEnum(soft.preferredTimeOfDay, ALLOWED_TIME_OF_DAY),
      preferredPace: pickEnum(soft.preferredPace, ALLOWED_PACE),
    },
    novelty: { level, targetScore, reason: cleanString(novelty.reason, 60) || 'client_supplied' },
    surprise:
      surprise && surprise.value
        ? { value: cleanString(surprise.value, 60), dimension: cleanString(surprise.dimension, 40) }
        : null,
  };
}

/** Rebuilds the verified-facts context. This is the model's only fact source. */
function sanitizeContext(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const weather = raw.weather && typeof raw.weather === 'object' ? raw.weather : null;

  const places = Array.isArray(raw.places)
    ? raw.places
        .map(p => {
          const name = cleanString(p?.name, CAPS.placeNameChars);
          return name ? { name } : null;
        })
        .filter(Boolean)
        .slice(0, CAPS.places)
    : [];

  const events = Array.isArray(raw.events)
    ? raw.events
        .map(e => {
          const title = cleanString(e?.title, CAPS.placeNameChars);
          return title ? { title } : null;
        })
        .filter(Boolean)
        .slice(0, CAPS.events)
    : [];

  return {
    city: cleanString(raw.city, 60),
    district: cleanString(raw.district, 60),
    neighborhood: cleanString(raw.neighborhood, 60),
    season: cleanString(raw.season, 30),
    dayOfWeek: cleanString(raw.dayOfWeek, 12),
    timeOfDay: pickEnum(raw.timeOfDay, ALLOWED_TIME_OF_DAY),
    sunsetTime: cleanString(raw.sunsetTime, 12),
    sunriseTime: cleanString(raw.sunriseTime, 12),
    goldenHourStart: cleanString(raw.goldenHourStart, 12),
    places,
    events,
    weather: weather
      ? {
          condition: pickEnum(weather.condition, ALLOWED_WEATHER),
          temperatureCelsius: clampInt(weather.temperatureCelsius, -40, 60),
          precipitationProbability: clampInt(weather.precipitationProbability, 0, 100),
          sunsetTime: cleanString(weather.sunsetTime, 12),
          isGoldenHour: weather.isGoldenHour === true,
        }
      : undefined,
  };
}

function sanitizeConstraints(raw) {
  if (!raw || typeof raw !== 'object') return { exclusions: [], accessibilityNeeds: [] };
  return {
    maxDurationMinutes: clampInt(raw.maxDurationMinutes, 5, 1440),
    maxBudgetNpr: clampInt(raw.maxBudgetNpr, 0, 1000000),
    maxDistanceMeters: clampInt(raw.maxDistanceMeters, 50, 100000),
    requireIndoor: raw.requireIndoor === true ? true : undefined,
    requireDaylight: raw.requireDaylight === true ? true : undefined,
    exclusions: cleanStringArray(raw.exclusions, CAPS.exclusions, 40),
    accessibilityNeeds: cleanStringArray(raw.accessibilityNeeds, CAPS.accessibilityNeeds, 40),
  };
}

function sanitizeRequest(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return {
    availableTimeMinutes: clampInt(raw.availableTimeMinutes, 5, 1440),
    energy: cleanString(raw.energy, 30),
    mood: cleanString(raw.mood, 30),
    budgetMaxNpr: clampInt(raw.budgetMaxNpr, 0, 1000000),
    socialPreference: cleanString(raw.socialPreference, 30),
    environmentPreference: cleanString(raw.environmentPreference, 30),
    requestedCategory: cleanString(raw.requestedCategory, 40),
  };
}

// A tighter limit than the global cost middleware: generation is the expensive path.
const generationLimiter = rateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 12,
  message: 'Too many AI generation requests. Please wait a moment.',
});

const cheapLimiter = rateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 40,
  message: 'Too many requests. Please slow down.',
});

// ─── Personalized quest generation ──────────────────────────
router.post(
  '/quest',
  requireIdentity,
  enforceSelfOnly,
  generationLimiter,
  async (req, res) => {
    try {
      const userId = req.auth.userId;

      const personalization = sanitizePersonalization(req.body?.personalization, userId);
      if (personalization?.__rejected) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'CROSS_USER_CONTEXT_DENIED',
            message: 'The personalization context does not belong to the authenticated user.',
          },
        });
      }

      const context = sanitizeContext(req.body?.context);
      const constraints = sanitizeConstraints(req.body?.constraints);
      const request = sanitizeRequest(req.body?.request);

      // Reject precise coordinates outright: they must never reach a prompt or a log.
      if (req.body?.context?.latitude !== undefined || req.body?.context?.longitude !== undefined) {
        const { latitude, longitude } = req.body.context;
        if (!validateCoordinates(latitude, longitude)) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_COORDINATES', message: 'Coordinates are out of range.' },
          });
        }
        // Valid but discarded: the prompt gets city/district only.
      }

      // Cache identical contexts so repeated taps do not repeatedly bill a model.
      // The key is per-user so no user can ever be served another user's result.
      const cacheKey = JSON.stringify({
        u: userId,
        c: context.city,
        t: context.timeOfDay,
        w: context.weather?.condition,
        r: request,
        n: personalization?.novelty?.level,
      });

      const cached = getCachedQuests(cacheKey);
      if (cached) {
        return res.json({ ...cached, cached: true });
      }

      const result = await aiProvider.generateQuest({
        userId,
        context,
        request,
        personalization: personalization?.enabled ? personalization : null,
        constraints,
      });

      const payload = {
        success: true,
        source: result.source,
        model: result.model,
        quest: result.quest,
        personalizationApplied: Boolean(personalization?.enabled),
        // Present when the AI layers were rejected and we fell through.
        ...(result.rejections ? { fallbackReasons: result.rejections.map(r => r.reason) } : {}),
        identityVerified: req.auth.verified,
      };

      setCachedQuests(cacheKey, payload);
      return res.json(payload);
    } catch (error) {
      console.error('[EXTROVELA Intelligence] quest generation failed:', error.message);
      return res.status(500).json({
        success: false,
        error: { code: 'GENERATION_FAILED', message: 'Could not generate an experience right now.' },
      });
    }
  }
);

// ─── Recap narrative (Phase 12 consumes this) ───────────────
router.post('/recap-story', requireIdentity, enforceSelfOnly, generationLimiter, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { periodLabel, statistics, highlights, places, firsts } = req.body || {};

    // Only numeric statistics are accepted. A string statistic could smuggle prose
    // into the prompt and would not be checkable by the number guard.
    const cleanStats = {};
    if (statistics && typeof statistics === 'object') {
      for (const [key, value] of Object.entries(statistics).slice(0, 14)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          cleanStats[key] = Math.round(value);
        }
      }
    }

    const result = await aiProvider.generateRecapStory({
      userId,
      periodLabel: cleanString(periodLabel, 40) || 'this period',
      statistics: cleanStats,
      highlights: cleanStringArray(highlights, 8, CAPS.freeTextChars),
      places: cleanStringArray(places, 8, CAPS.placeNameChars),
      firsts: cleanStringArray(firsts, 6, CAPS.freeTextChars),
    });

    return res.json({
      success: true,
      source: result.source,
      model: result.model || null,
      // Explicitly surfaced: false means the client MUST render stats without prose.
      narrativeAvailable: result.narrativeAvailable === true,
      title: result.title || null,
      story: result.story ?? null,
      highlights: result.highlights || [],
      ...(result.rejections ? { fallbackReasons: result.rejections.map(r => r.reason) } : {}),
    });
  } catch (error) {
    console.error('[EXTROVELA Intelligence] recap generation failed:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'RECAP_FAILED', message: 'Could not generate a recap right now.' },
    });
  }
});

// ─── Memory title suggestions ───────────────────────────────
router.post('/memory-titles', requireIdentity, enforceSelfOnly, cheapLimiter, async (req, res) => {
  try {
    const { questTitle, category, placeName, tags, mood } = req.body || {};

    const result = await aiProvider.suggestMemoryTitles({
      questTitle: cleanString(questTitle, 120),
      category: cleanString(category, 40),
      placeName: cleanString(placeName, CAPS.placeNameChars),
      tags: cleanStringArray(tags, 6, 30),
      mood: cleanString(mood, 30),
    });

    return res.json({
      success: true,
      source: result.source,
      // Titles are SUGGESTIONS. The client must let the user edit or discard them.
      titles: result.titles || [],
      userEditable: true,
    });
  } catch (error) {
    console.error('[EXTROVELA Intelligence] title suggestion failed:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'TITLE_SUGGESTION_FAILED', message: 'Could not suggest titles right now.' },
    });
  }
});

// ─── Constrained classification ─────────────────────────────
router.post('/classify', requireIdentity, enforceSelfOnly, cheapLimiter, async (req, res) => {
  try {
    const { instruction, input, allowedLabels } = req.body || {};
    const labels = cleanStringArray(allowedLabels, 30, 60);

    if (labels.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LABELS',
          message: 'allowedLabels is required — free-form classification is not permitted.',
        },
      });
    }

    const result = await aiProvider.classify({
      instruction: cleanString(instruction, CAPS.freeTextChars) || 'Classify the input.',
      input: cleanString(input, 800) || '',
      allowedLabels: labels,
    });

    return res.json({ success: true, source: result.source, ...result });
  } catch (error) {
    console.error('[EXTROVELA Intelligence] classification failed:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'CLASSIFICATION_FAILED', message: 'Could not classify right now.' },
    });
  }
});

// ─── Account data: deletion manifest (audit-safe) ───────────
// Returns the authoritative list of every path that constitutes a complete
// erasure for the authenticated user. Pure/read-only: builds nothing, deletes
// nothing, and never references a client-supplied id — only req.auth.userId.
router.get('/account/deletion-manifest', requireIdentity, enforceSelfOnly, cheapLimiter, (req, res) => {
  try {
    const manifest = buildDeletionManifest(req.auth.userId);
    return res.json({
      success: true,
      identityVerified: req.auth.verified,
      manifest,
    });
  } catch (error) {
    console.error('[EXTROVELA Intelligence] deletion manifest failed:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'MANIFEST_FAILED', message: 'Could not build a deletion manifest right now.' },
    });
  }
});

// ─── Account data: delete everything for the authenticated user ─────
// Honest by construction: when firebase-admin is not configured this performs
// NO server-side purge and says so (serverSidePurgePerformed:false,
// clientMustComplete:true). The client remains responsible for erasing its own
// Firestore subcollections. The userId is ALWAYS the authenticated identity —
// there is no code path here that deletes data for a client-supplied id.
router.delete('/account', requireIdentity, enforceSelfOnly, cheapLimiter, async (req, res) => {
  try {
    const result = await deleteUserAccountData(req.auth.userId);
    return res.json({
      success: true,
      identityVerified: req.auth.verified,
      ...result,
    });
  } catch (error) {
    console.error('[EXTROVELA Intelligence] account deletion failed:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'DELETION_FAILED', message: 'Could not process the deletion request right now.' },
    });
  }
});

// ─── Health / capability probe ──────────────────────────────
// Reports what is ACTUALLY wired, so nothing has to be taken on trust.
router.get('/ai-health', (req, res) => {
  const health = aiProvider.health();
  res.json({
    success: true,
    geminiConfigured: health.geminiConfigured,
    deterministicFallbackAvailable: health.deterministicAvailable,
    identityVerificationActive: false, // see requireIdentity.js — requires firebase-admin
    routing: {
      generateQuest: { tier: health.routing.generateQuest.tier, model: health.routing.generateQuest.primaryModel },
      recapStory: { tier: health.routing.recapStory.tier, model: health.routing.recapStory.primaryModel },
      classify: { tier: health.routing.classify.tier, model: health.routing.classify.primaryModel },
      memoryTitle: { tier: health.routing.memoryTitle.tier, model: health.routing.memoryTitle.primaryModel },
    },
    stats: health.stats,
  });
});

export default router;
