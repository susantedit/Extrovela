/**
 * EXTROVELA — Intelligence API Client (Phase 12)
 *
 * The client → server bridge to the Phase 11 AI endpoints. Phase 11 built and
 * mounted these routes but deliberately left the client unwired; Phase 12 wires
 * the two that Memory Journal 2.0 needs: recap narratives and memory-title
 * suggestions.
 *
 * Honesty rules baked in here:
 *   - No API keys ever touch this file. It calls our own server, which holds them.
 *   - Identity is sent as the `x-user-id` header. In development the server trusts
 *     it (requireIdentity.js); in production the server requires a verified
 *     Firebase token (firebase-admin) and this header alone will be rejected —
 *     see PHASE_12_REPORT.md. Either way the caller degrades gracefully.
 *   - Every failure path returns an explicit "unavailable" result. Nothing here
 *     invents a narrative or a title; when the server can't help, the caller
 *     renders facts without prose.
 *   - Only NUMERIC statistics are sent for recaps — never raw reflection text.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface RecapStoryRequest {
  userId: string;
  periodLabel: string;
  statistics: Record<string, number>; // numeric only — enforced again server-side
  highlights?: string[];
  places?: string[];
  firsts?: string[];
}

export interface RecapStoryResult {
  narrativeAvailable: boolean;
  title: string | null;
  story: string | null;
  highlights: string[];
  source: 'ai-primary' | 'ai-fallback' | 'deterministic' | 'unavailable';
}

export interface MemoryTitlesRequest {
  userId: string;
  questTitle?: string;
  category?: string;
  placeName?: string;
  tags?: string[];
  mood?: string;
}

const UNAVAILABLE_RECAP: RecapStoryResult = {
  narrativeAvailable: false,
  title: null,
  story: null,
  highlights: [],
  source: 'unavailable',
};

async function postIntelligence<T>(path: string, userId: string, body: unknown, timeoutMs: number): Promise<T | null> {
  if (!userId) return null; // no identity → no call (fails closed, never guesses)
  try {
    const res = await fetch(`${API_BASE_URL}/intelligence${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Dev identity. Prod requires a verified token; see file header.
        'x-user-id': userId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Offline, timeout, server down — all handled the same honest way by callers.
    return null;
  }
}

export const intelligenceClient = {
  /**
   * Requests a recap narrative. Returns narrativeAvailable:false on any failure OR
   * when the server itself could not ground a narrative — the caller MUST then
   * render statistics without prose.
   */
  async generateRecapStory(req: RecapStoryRequest): Promise<RecapStoryResult> {
    // Strip anything non-numeric before it leaves the device.
    const statistics: Record<string, number> = {};
    for (const [k, v] of Object.entries(req.statistics || {})) {
      if (typeof v === 'number' && Number.isFinite(v)) statistics[k] = Math.round(v);
    }

    const data = await postIntelligence<{
      success: boolean;
      narrativeAvailable?: boolean;
      title?: string | null;
      story?: string | null;
      highlights?: string[];
      source?: RecapStoryResult['source'];
    }>('/recap-story', req.userId, {
      periodLabel: req.periodLabel,
      statistics,
      highlights: req.highlights || [],
      places: req.places || [],
      firsts: req.firsts || [],
    }, 8000);

    if (!data || data.success !== true || data.narrativeAvailable !== true) {
      return UNAVAILABLE_RECAP;
    }
    return {
      narrativeAvailable: true,
      title: data.title ?? null,
      story: data.story ?? null,
      highlights: Array.isArray(data.highlights) ? data.highlights : [],
      source: data.source || 'ai-primary',
    };
  },

  /**
   * Requests up to a handful of memory-title SUGGESTIONS. Returns [] on any
   * failure. Titles are always user-editable; the caller must never auto-apply.
   */
  async suggestMemoryTitles(req: MemoryTitlesRequest): Promise<string[]> {
    const data = await postIntelligence<{ success: boolean; titles?: string[] }>(
      '/memory-titles',
      req.userId,
      {
        questTitle: req.questTitle,
        category: req.category,
        placeName: req.placeName,
        tags: req.tags,
        mood: req.mood,
      },
      6000
    );
    if (!data || data.success !== true || !Array.isArray(data.titles)) return [];
    return data.titles.filter(t => typeof t === 'string' && t.trim().length > 0).slice(0, 6);
  },
};

export default intelligenceClient;
