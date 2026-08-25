/**
 * EXTROVELA — Phase 11: Gemini Provider
 *
 * Thin, dependency-free wrapper over the Gemini REST API. Matches the existing
 * pattern in server/routes/api.js (raw fetch + responseMimeType: application/json)
 * rather than introducing an SDK.
 *
 * The API key is read from process.env on the server and is NEVER returned to a
 * caller, logged, or included in an error message.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_TIMEOUT_MS = 20000;

export function isConfigured() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key !== 'YOUR_GEMINI_API_KEY' && key.length > 10);
}

/** Redacts the key from anything we might log. */
function scrub(message) {
  const key = process.env.GEMINI_API_KEY;
  let out = String(message || '');
  if (key && key.length > 6) out = out.split(key).join('[REDACTED_KEY]');
  return out.replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
}

export class GeminiProvider {
  constructor(options = {}) {
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.name = 'gemini';
  }

  isAvailable() {
    return isConfigured();
  }

  /**
   * Sends a prompt and returns the raw text. Returns
   * { ok, text, model, latencyMs, error } — never throws for an API failure.
   */
  async complete({ prompt, model, temperature = 0.7, maxOutputTokens = 1200 }) {
    if (!this.isAvailable()) {
      return { ok: false, text: null, model, latencyMs: 0, error: 'gemini_not_configured' };
    }
    if (!prompt || typeof prompt !== 'string') {
      return { ok: false, text: null, model, latencyMs: 0, error: 'empty_prompt' };
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature,
              maxOutputTokens,
            },
            // Block the model's own unsafe output at the source.
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            ],
          }),
        }
      );

      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        // Body may echo the request URL; scrub before it reaches a log.
        let detail = '';
        try {
          detail = scrub((await response.text()).slice(0, 200));
        } catch {
          detail = '';
        }
        return {
          ok: false,
          text: null,
          model,
          latencyMs,
          error: `gemini_http_${response.status}`,
          detail,
          retryable: response.status === 429 || response.status >= 500,
        };
      }

      const data = await response.json();
      const blockReason = data?.promptFeedback?.blockReason;
      if (blockReason) {
        return { ok: false, text: null, model, latencyMs, error: `gemini_blocked_${blockReason}` };
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return { ok: false, text: null, model, latencyMs, error: 'gemini_empty_candidate' };
      }

      return {
        ok: true,
        text,
        model,
        latencyMs,
        finishReason: data?.candidates?.[0]?.finishReason,
      };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const aborted = err?.name === 'AbortError';
      return {
        ok: false,
        text: null,
        model,
        latencyMs,
        error: aborted ? 'gemini_timeout' : 'gemini_network_error',
        detail: scrub(err?.message).slice(0, 200),
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const geminiProvider = new GeminiProvider();
export default geminiProvider;
