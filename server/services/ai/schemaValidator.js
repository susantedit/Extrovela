/**
 * EXTROVELA — Phase 11: AI Output Schema Validator
 *
 * Every AI response is treated as untrusted input. This module enforces the
 * expected shape BEFORE anything reaches product logic, so a malformed or
 * adversarial model response degrades to a deterministic fallback instead of
 * corrupting a user's quest.
 *
 * Deliberately dependency-free: no ajv, no zod on the server. The schemas are
 * small and the validator is auditable in one screen.
 */

const MAX_STRING = 2000;

/** Field type checkers. */
const CHECKS = {
  string: v => typeof v === 'string',
  number: v => typeof v === 'number' && Number.isFinite(v),
  boolean: v => typeof v === 'boolean',
  array: v => Array.isArray(v),
  object: v => v !== null && typeof v === 'object' && !Array.isArray(v),
};

/**
 * Validates a value against a compact field spec.
 * spec = { type, required, min, max, maxLength, enum, of, minItems, maxItems, fields }
 */
function validateField(path, value, spec, errors) {
  if (value === undefined || value === null) {
    if (spec.required) errors.push(`${path}: required`);
    return;
  }

  const check = CHECKS[spec.type];
  if (!check || !check(value)) {
    errors.push(`${path}: expected ${spec.type}`);
    return;
  }

  if (spec.type === 'string') {
    const limit = spec.maxLength || MAX_STRING;
    if (value.length > limit) errors.push(`${path}: exceeds ${limit} chars`);
    if (spec.minLength && value.length < spec.minLength) {
      errors.push(`${path}: shorter than ${spec.minLength} chars`);
    }
    if (spec.enum && !spec.enum.includes(value)) {
      errors.push(`${path}: not one of allowed values`);
    }
  }

  if (spec.type === 'number') {
    if (spec.min !== undefined && value < spec.min) errors.push(`${path}: below min ${spec.min}`);
    if (spec.max !== undefined && value > spec.max) errors.push(`${path}: above max ${spec.max}`);
    if (spec.integer && !Number.isInteger(value)) errors.push(`${path}: must be an integer`);
  }

  if (spec.type === 'array') {
    if (spec.minItems !== undefined && value.length < spec.minItems) {
      errors.push(`${path}: fewer than ${spec.minItems} items`);
    }
    if (spec.maxItems !== undefined && value.length > spec.maxItems) {
      errors.push(`${path}: more than ${spec.maxItems} items`);
    }
    if (spec.of) {
      value.forEach((item, i) => validateField(`${path}[${i}]`, item, spec.of, errors));
    }
  }

  if (spec.type === 'object' && spec.fields) {
    validateObject(path, value, spec.fields, errors, spec.allowUnknown);
  }
}

function validateObject(path, value, fields, errors, allowUnknown = false) {
  for (const [key, spec] of Object.entries(fields)) {
    validateField(path ? `${path}.${key}` : key, value[key], spec, errors);
  }
  if (!allowUnknown) {
    const unknown = Object.keys(value).filter(k => !(k in fields));
    if (unknown.length > 0) {
      errors.push(`${path || 'root'}: unexpected fields [${unknown.join(', ')}]`);
    }
  }
}

/**
 * Schema for a single AI-generated quest.
 *
 * Note what is ABSENT: no coordinates, no opening hours, no place ids, no
 * weather, no event times. Those are real-world facts and come from the Context
 * Engine, never from the model. See hallucinationGuard.js.
 */
export const AI_QUEST_SCHEMA = {
  title: { type: 'string', required: true, minLength: 4, maxLength: 90 },
  description: { type: 'string', required: true, minLength: 20, maxLength: 600 },
  category: { type: 'string', required: true, maxLength: 40 },
  /** Suggested steps as plain instructions. */
  steps: {
    type: 'array',
    required: false,
    maxItems: 6,
    of: { type: 'string', maxLength: 240 },
  },
  estimatedMinutes: { type: 'number', required: false, min: 5, max: 480, integer: true },
  /** Why this fits — must reference only facts we supplied. */
  whyThisQuest: { type: 'string', required: false, maxLength: 300 },
  tags: { type: 'array', required: false, maxItems: 8, of: { type: 'string', maxLength: 30 } },
  /**
   * The model may only reference a placeName we explicitly gave it in the prompt.
   * The guard verifies this against the allow-list.
   */
  suggestedPlaceName: { type: 'string', required: false, maxLength: 120 },
};

/** Schema for classification/extraction tasks routed to the cheap model. */
export const AI_CLASSIFICATION_SCHEMA = {
  label: { type: 'string', required: true, maxLength: 60 },
  confidence: { type: 'number', required: true, min: 0, max: 1 },
  reason: { type: 'string', required: false, maxLength: 240 },
};

/** Schema for a recap narrative (Phase 12 consumes this). */
export const AI_RECAP_SCHEMA = {
  story: { type: 'string', required: true, minLength: 40, maxLength: 1800 },
  title: { type: 'string', required: false, maxLength: 90 },
  /** Highlight lines. Each must be traceable to a supplied statistic. */
  highlights: {
    type: 'array',
    required: false,
    maxItems: 6,
    of: { type: 'string', maxLength: 200 },
  },
};

/** Schema for AI-suggested memory titles. */
export const AI_MEMORY_TITLE_SCHEMA = {
  titles: {
    type: 'array',
    required: true,
    minItems: 1,
    maxItems: 5,
    of: { type: 'string', minLength: 3, maxLength: 70 },
  },
};

/**
 * Parses and validates a raw model response.
 * Returns { valid, data, errors } — never throws.
 */
export function validateAiJson(rawText, fields, options = {}) {
  const { allowUnknown = false, arrayOf = false, minItems = 1, maxItems = 10 } = options;

  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    return { valid: false, data: null, errors: ['empty_response'] };
  }

  // Models occasionally wrap JSON in a code fence despite responseMimeType.
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { valid: false, data: null, errors: ['invalid_json'] };
  }

  const errors = [];

  if (arrayOf) {
    if (!Array.isArray(parsed)) {
      return { valid: false, data: null, errors: ['expected_array'] };
    }
    if (parsed.length < minItems) errors.push(`fewer than ${minItems} items`);
    if (parsed.length > maxItems) parsed = parsed.slice(0, maxItems);
    parsed.forEach((item, i) => {
      if (!CHECKS.object(item)) {
        errors.push(`[${i}]: expected object`);
        return;
      }
      validateObject(`[${i}]`, item, fields, errors, allowUnknown);
    });
  } else {
    if (!CHECKS.object(parsed)) {
      return { valid: false, data: null, errors: ['expected_object'] };
    }
    validateObject('', parsed, fields, errors, allowUnknown);
  }

  return { valid: errors.length === 0, data: errors.length === 0 ? parsed : null, errors };
}

export default { validateAiJson, AI_QUEST_SCHEMA, AI_CLASSIFICATION_SCHEMA, AI_RECAP_SCHEMA, AI_MEMORY_TITLE_SCHEMA };
