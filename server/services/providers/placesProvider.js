/**
 * EXTROVELA — Phase 13: Places Provider (server-side)
 *
 * Real nearby-place discovery behind a provider abstraction. The keyless default
 * is OpenStreetMap: Overpass API for "what's around this point" and Nominatim for
 * free-text / city search. Set PLACES_PROVIDER=geoapify + GEOAPIFY_API_KEY to swap
 * in a commercial provider without touching any caller.
 *
 * Mirrors server/services/ai/geminiProvider.js: isConfigured() gate, scrub(),
 * AbortController timeout, { ok, data, error, retryable } that NEVER throws.
 * Elements are normalized to the internal Place model (src/types/place.ts) — raw
 * OSM/Overpass JSON never leaves this file.
 *
 * OSM etiquette: Overpass and Nominatim REQUIRE a descriptive User-Agent (set
 * NOMINATIM_USER_AGENT). We never log precise coordinates or keys.
 */

const OVERPASS_ENDPOINT = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const NOMINATIM_ENDPOINT = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const GEOAPIFY_ENDPOINT = 'https://api.geoapify.com/v2/places';
const DEFAULT_TIMEOUT_MS = 12000;
const MAX_RESULTS = 60;
const MAX_RADIUS_M = 5000;

function userAgent() {
  return process.env.NOMINATIM_USER_AGENT || 'EXTROVELA/1.0 (real-world discovery; contact: set NOMINATIM_USER_AGENT)';
}

function selectedProvider() {
  return (process.env.PLACES_PROVIDER || 'osm').toLowerCase();
}

/** True when the selected provider can serve requests. OSM (Overpass/Nominatim) is keyless. */
export function isConfigured() {
  if (selectedProvider() === 'geoapify') {
    const key = process.env.GEOAPIFY_API_KEY;
    return Boolean(key && key !== 'YOUR_GEOAPIFY_API_KEY' && key.length > 10);
  }
  return true;
}

function scrub(message) {
  const key = process.env.GEOAPIFY_API_KEY;
  let out = String(message || '');
  if (key && key.length > 6) out = out.split(key).join('[REDACTED_KEY]');
  return out.replace(/apiKey=[^&\s]+/gi, 'apiKey=[REDACTED]');
}

// --- OSM tag → internal Place normalization ----------------------------------

// Categories we treat as open-air; everything else defaults to indoor.
const OUTDOOR_CATEGORIES = new Set([
  'park', 'garden', 'viewpoint', 'beach', 'pitch', 'playground', 'nature_reserve',
  'dog_park', 'water_park', 'picnic_site', 'camp_site', 'attraction', 'artwork',
  'monument', 'memorial', 'fountain', 'square', 'marketplace', 'bandstand',
]);

function deriveCategory(tags) {
  return (
    tags.amenity || tags.leisure || tags.tourism || tags.shop || tags.historic || 'place'
  );
}

function deriveIndoor(category, tags) {
  if (OUTDOOR_CATEGORIES.has(category)) return false;
  if (tags.leisure === 'park' || tags.tourism === 'viewpoint') return false;
  return true;
}

function buildTags(tags, category) {
  const out = new Set();
  if (category) out.add(String(category));
  for (const k of ['cuisine', 'tourism', 'leisure', 'shop', 'historic', 'sport']) {
    if (tags[k]) String(tags[k]).split(';').forEach((v) => out.add(v.trim()));
  }
  return [...out].filter(Boolean).slice(0, 8);
}

function osmElementToPlace(el, fallbackCity) {
  const tags = el.tags || {};
  const name = tags.name;
  if (!name) return null; // never surface an unnamed node — AI must not invent names
  const lat = typeof el.lat === 'number' ? el.lat : el.center?.lat;
  const lng = typeof el.lon === 'number' ? el.lon : el.center?.lon;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const category = deriveCategory(tags);
  return {
    id: `osm_${el.type}_${el.id}`,
    name,
    city: tags['addr:city'] || fallbackCity || '',
    neighborhood: tags['addr:suburb'] || tags['addr:neighbourhood'] || undefined,
    coordinates: { lat, lng },
    category,
    isIndoor: deriveIndoor(category, tags),
    rating: undefined, // OSM carries no rating; a keyed provider can supply one
    tags: buildTags(tags, category),
    openingHours: tags.opening_hours || undefined, // raw OSM opening_hours string
  };
}

export class PlacesProvider {
  constructor(options = {}) {
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.name = 'places';
  }

  isAvailable() {
    return isConfigured();
  }

  /**
   * Nearby places around a point.
   * @returns {Promise<{ok:boolean, data?:object[], latencyMs:number, error?:string, retryable?:boolean}>}
   * data is a normalized Place[]. Never throws.
   */
  async searchNearby(lat, lng, radiusMeters = 1500, category) {
    if (!this.isAvailable()) return { ok: false, latencyMs: 0, error: 'places_not_configured' };
    const radius = Math.min(Math.max(Number(radiusMeters) || 1500, 100), MAX_RADIUS_M);
    if (selectedProvider() === 'geoapify') return this.#geoapifyNearby(lat, lng, radius, category);
    return this.#overpassNearby(lat, lng, radius, category);
  }

  /** Free-text / city search via Nominatim (keyless path only for now). */
  async searchText(query, limit = 10) {
    if (selectedProvider() === 'geoapify') {
      return { ok: false, latencyMs: 0, error: 'places_text_unsupported_for_provider' };
    }
    const q = String(query || '').trim();
    if (!q) return { ok: false, latencyMs: 0, error: 'places_empty_query' };
    const url =
      `${NOMINATIM_ENDPOINT}/search?format=jsonv2&addressdetails=1&limit=${Math.min(Number(limit) || 10, 25)}` +
      `&q=${encodeURIComponent(q)}`;
    return this.#request(url, { headers: { 'User-Agent': userAgent(), Accept: 'application/json' } }, (raw) => {
      if (!Array.isArray(raw)) return [];
      return raw
        .map((r) => {
          const lat = Number(r.lat);
          const lng = Number(r.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const addr = r.address || {};
          return {
            id: `nominatim_${r.osm_type || 'x'}_${r.osm_id || r.place_id}`,
            name: r.name || r.display_name?.split(',')[0] || 'Unknown',
            city: addr.city || addr.town || addr.village || '',
            neighborhood: addr.suburb || addr.neighbourhood || undefined,
            coordinates: { lat, lng },
            category: r.category || r.type || 'place',
            isIndoor: true,
            tags: [r.type].filter(Boolean),
          };
        })
        .filter(Boolean);
    });
  }

  async #overpassNearby(lat, lng, radius, category) {
    // Broad POI sweep bounded by radius + output cap. `nwr ... out center` gives a
    // representative coordinate for ways/relations, not just nodes.
    const around = `(around:${radius},${lat},${lng})`;
    const keys = ['amenity', 'leisure', 'tourism', 'shop', 'historic'];
    const body =
      `[out:json][timeout:20];(` +
      keys.map((k) => `nwr["${k}"]${around};`).join('') +
      `);out center ${MAX_RESULTS};`;
    return this.#request(
      OVERPASS_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent(),
        },
        body: `data=${encodeURIComponent(body)}`,
      },
      (raw) => {
        const elements = Array.isArray(raw?.elements) ? raw.elements : [];
        let places = elements.map((el) => osmElementToPlace(el)).filter(Boolean);
        if (category) {
          const needle = String(category).toLowerCase();
          places = places.filter(
            (p) => p.category?.toLowerCase().includes(needle) || p.tags?.some((t) => t.toLowerCase().includes(needle))
          );
        }
        // De-duplicate by id (Overpass can echo the same feature across keys).
        const seen = new Set();
        return places.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
      }
    );
  }

  async #geoapifyNearby(lat, lng, radius, category) {
    const key = process.env.GEOAPIFY_API_KEY;
    const categories = category ? encodeURIComponent(category) : 'commercial,catering,leisure,tourism';
    const url =
      `${GEOAPIFY_ENDPOINT}?categories=${categories}` +
      `&filter=circle:${lng},${lat},${radius}&bias=proximity:${lng},${lat}&limit=${MAX_RESULTS}&apiKey=${key}`;
    return this.#request(url, { headers: { Accept: 'application/json' } }, (raw) => {
      const feats = Array.isArray(raw?.features) ? raw.features : [];
      return feats
        .map((f) => {
          const p = f.properties || {};
          const lat2 = Number(p.lat);
          const lng2 = Number(p.lon);
          if (!Number.isFinite(lat2) || !Number.isFinite(lng2) || !p.name) return null;
          return {
            id: `geoapify_${p.place_id || `${lat2},${lng2}`}`,
            name: p.name,
            city: p.city || '',
            neighborhood: p.suburb || p.district || undefined,
            coordinates: { lat: lat2, lng: lng2 },
            category: (Array.isArray(p.categories) && p.categories[0]) || 'place',
            isIndoor: true,
            tags: Array.isArray(p.categories) ? p.categories.slice(0, 8) : [],
            openingHours: p.opening_hours || undefined,
          };
        })
        .filter(Boolean);
    });
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
          error: `places_http_${response.status}`,
          retryable: response.status === 429 || response.status >= 500,
        };
      }
      const raw = await response.json();
      const data = normalize(raw);
      if (!Array.isArray(data)) return { ok: false, latencyMs, error: 'places_malformed_response' };
      return { ok: true, data, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const aborted = err?.name === 'AbortError';
      return {
        ok: false,
        latencyMs,
        error: aborted ? 'places_timeout' : 'places_network_error',
        detail: scrub(err?.message).slice(0, 160),
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const placesProvider = new PlacesProvider();
export default placesProvider;
