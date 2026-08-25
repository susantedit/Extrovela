/**
 * EXTROVELA — Phase 13: Routing Provider (server-side)
 *
 * Real point-to-point routing behind a provider abstraction. The keyless default
 * is OSRM. Set ROUTING_PROVIDER=ors + ORS_API_KEY to swap in OpenRouteService
 * without touching any caller.
 *
 * Mirrors server/services/ai/geminiProvider.js: isConfigured() gate, scrub(),
 * AbortController timeout, { ok, data, error, retryable } that NEVER throws.
 * Normalized output: { distanceMeters, durationSeconds, mode, geometry }.
 *
 * NOTE: the public OSRM demo host (router.project-osrm.org) is provisioned for the
 * car profile. For real walking/cycling durations, point OSRM_URL at a backend
 * built with the matching profile. Unsupported requests fail clean (never faked).
 */

const OSRM_BASE = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
const ORS_BASE = 'https://api.openrouteservice.org/v2/directions';
const DEFAULT_TIMEOUT_MS = 8000;

// internal mode → provider profile
const OSRM_PROFILE = { walking: 'foot', cycling: 'bike', driving: 'driving' };
const ORS_PROFILE = { walking: 'foot-walking', cycling: 'cycling-regular', driving: 'driving-car' };

function selectedProvider() {
  return (process.env.ROUTING_PROVIDER || 'osrm').toLowerCase();
}

/** True when the selected provider can serve requests. OSRM is keyless. */
export function isConfigured() {
  if (selectedProvider() === 'ors') {
    const key = process.env.ORS_API_KEY;
    return Boolean(key && key !== 'YOUR_ORS_API_KEY' && key.length > 10);
  }
  return true;
}

function scrub(message) {
  const key = process.env.ORS_API_KEY;
  let out = String(message || '');
  if (key && key.length > 6) out = out.split(key).join('[REDACTED_KEY]');
  return out;
}

export class RoutingProvider {
  constructor(options = {}) {
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.name = 'routing';
  }

  isAvailable() {
    return isConfigured();
  }

  /**
   * @param {{lat:number,lng:number}} start
   * @param {{lat:number,lng:number}} end
   * @param {'walking'|'cycling'|'driving'} mode
   * @returns {Promise<{ok:boolean, data?:object, latencyMs:number, error?:string, retryable?:boolean}>}
   * Never throws.
   */
  async getRoute(start, end, mode = 'walking') {
    if (!this.isAvailable()) return { ok: false, latencyMs: 0, error: 'routing_not_configured' };
    if (!OSRM_PROFILE[mode] && !ORS_PROFILE[mode]) {
      return { ok: false, latencyMs: 0, error: 'routing_mode_unsupported' };
    }
    if (selectedProvider() === 'ors') return this.#ors(start, end, mode);
    return this.#osrm(start, end, mode);
  }

  async #osrm(start, end, mode) {
    const profile = OSRM_PROFILE[mode] || 'driving';
    const url =
      `${OSRM_BASE}/route/v1/${profile}/` +
      `${start.lng},${start.lat};${end.lng},${end.lat}?overview=false&alternatives=false&steps=false`;
    return this.#request(url, { headers: { Accept: 'application/json' } }, (raw) => {
      if (raw?.code !== 'Ok' || !Array.isArray(raw.routes) || !raw.routes.length) return null;
      const r = raw.routes[0];
      return {
        distanceMeters: Number(r.distance),
        durationSeconds: Number(r.duration),
        mode,
        geometry: null,
      };
    });
  }

  async #ors(start, end, mode) {
    const key = process.env.ORS_API_KEY;
    const profile = ORS_PROFILE[mode] || 'foot-walking';
    const url = `${ORS_BASE}/${profile}`;
    return this.#request(
      url,
      {
        method: 'POST',
        headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ coordinates: [[start.lng, start.lat], [end.lng, end.lat]] }),
      },
      (raw) => {
        const summary = raw?.routes?.[0]?.summary || raw?.features?.[0]?.properties?.summary;
        if (!summary) return null;
        return {
          distanceMeters: Number(summary.distance),
          durationSeconds: Number(summary.duration),
          mode,
          geometry: null,
        };
      }
    );
  }

  /** Shared fetch + timeout + normalize wrapper. Never throws. */
  async #request(url, init, normalize) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        return {
          ok: false,
          latencyMs,
          error: `routing_http_${response.status}`,
          retryable: response.status === 429 || response.status >= 500,
        };
      }
      const raw = await response.json();
      const data = normalize(raw);
      if (!data || !Number.isFinite(data.distanceMeters) || !Number.isFinite(data.durationSeconds)) {
        return { ok: false, latencyMs, error: 'routing_no_route' };
      }
      return { ok: true, data, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const aborted = err?.name === 'AbortError';
      return {
        ok: false,
        latencyMs,
        error: aborted ? 'routing_timeout' : 'routing_network_error',
        detail: scrub(err?.message).slice(0, 160),
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const routingProvider = new RoutingProvider();
export default routingProvider;
