/**
 * EXTROVELA — Phase 13: Real-World Provider Routes
 *
 * Server-mediated access to weather / places / routing. The mobile bundle calls
 * THESE endpoints, never a provider directly, so any secret key stays server-side
 * (Steps 33/34/48). Each route:
 *   - validates coordinates before use (validator.js predicate),
 *   - rate-limits per caller (rateLimiter, keyed on x-user-id/ip),
 *   - serves a short in-memory TTL cache to avoid hammering keyless public APIs,
 *   - returns the normalized model on success or a clean typed error — and NEVER
 *     fabricates data. A provider that is not configured returns 503, not a mock.
 *
 * Privacy (Step 43): precise coordinates are never logged here.
 */

import express from 'express';
import weatherProvider, { isConfigured as weatherConfigured } from '../services/providers/weatherProvider.js';
import placesProvider, { isConfigured as placesConfigured } from '../services/providers/placesProvider.js';
import routingProvider, { isConfigured as routingConfigured } from '../services/providers/routingProvider.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { validateCoordinates } from '../middleware/validator.js';

const router = express.Router();

// ─── Tiny per-service TTL cache ─────────────────────────────
// Keyed on coarse (3-decimal ≈ 110m) coordinates so nearby callers share a hit
// and precise location is never used as a key. Bounded to avoid unbounded growth.
const CACHE_LIMIT = 500;

function makeCache(ttlMs) {
  const store = new Map(); // key -> { value, expires }
  return {
    get(key) {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (hit.expires < Date.now()) {
        store.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value) {
      if (store.size >= CACHE_LIMIT) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, expires: Date.now() + ttlMs });
    },
  };
}

const weatherCache = makeCache(5 * 60 * 1000); // 5 min
const placesCache = makeCache(60 * 60 * 1000); // 1 h
const routeCache = makeCache(30 * 60 * 1000); // 30 min

function coarse(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

// ─── Per-route limiters ─────────────────────────────────────
const weatherLimiter = rateLimiter({ windowMs: 60 * 1000, maxRequests: 30, message: 'Too many weather requests. Please slow down.' });
const placesLimiter = rateLimiter({ windowMs: 60 * 1000, maxRequests: 20, message: 'Too many place requests. Please slow down.' });
const routeLimiter = rateLimiter({ windowMs: 60 * 1000, maxRequests: 20, message: 'Too many route requests. Please slow down.' });

/** Maps a provider result.error → HTTP status. Not-configured is 503, not a mock. */
function statusForError(error) {
  if (typeof error === 'string' && error.endsWith('_not_configured')) return 503;
  if (typeof error === 'string' && (error.endsWith('_timeout') || error.includes('network'))) return 504;
  return 502;
}

function fail(res, error, code = 'PROVIDER_ERROR') {
  return res.status(statusForError(error)).json({ success: false, error: { code, message: error } });
}

// ─── Status (never returns a key) ───────────────────────────
router.get('/status', (req, res) => {
  const weather = (process.env.WEATHER_PROVIDER || 'open-meteo').toLowerCase();
  const places = (process.env.PLACES_PROVIDER || 'osm').toLowerCase();
  const routing = (process.env.ROUTING_PROVIDER || 'osrm').toLowerCase();
  const events = (process.env.EVENTS_PROVIDER || 'none').toLowerCase();
  res.json({
    success: true,
    providers: [
      { name: 'weather', provider: weather, keyless: weather !== 'openweather', configured: weatherConfigured() },
      { name: 'places', provider: places, keyless: places === 'osm', configured: placesConfigured() },
      { name: 'routing', provider: routing, keyless: routing === 'osrm', configured: routingConfigured() },
      // Events has no keyless option — key-gated and not wired in this pass.
      { name: 'events', provider: events, keyless: false, configured: events !== 'none' },
    ],
  });
});

// ─── Weather ────────────────────────────────────────────────
async function handleWeather(lat, lng, res) {
  if (!validateCoordinates(lat, lng)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_COORDINATES', message: 'Coordinates are out of range.' } });
  }
  const key = `${coarse(lat)},${coarse(lng)}`;
  const cached = weatherCache.get(key);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const result = await weatherProvider.getWeather(lat, lng);
  if (!result.ok) return fail(res, result.error, 'WEATHER_UNAVAILABLE');
  weatherCache.set(key, result.data);
  return res.json({ success: true, data: result.data });
}

router.get('/weather', weatherLimiter, (req, res) => handleWeather(Number(req.query.lat), Number(req.query.lng), res));
router.post('/weather', weatherLimiter, (req, res) => handleWeather(Number(req.body?.lat), Number(req.body?.lng), res));

// ─── Places (nearby via Overpass, text via Nominatim) ───────
async function handlePlaces({ lat, lng, radius, category, q }, res) {
  // Text-search mode (no coordinates required).
  if (q) {
    const result = await placesProvider.searchText(q);
    if (!result.ok) return fail(res, result.error, 'PLACES_UNAVAILABLE');
    return res.json({ success: true, data: result.data });
  }
  if (!validateCoordinates(lat, lng)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_COORDINATES', message: 'Coordinates are out of range.' } });
  }
  const radiusM = Number.isFinite(radius) ? radius : 1500;
  const cat = category || '';
  const key = `${coarse(lat)},${coarse(lng)}:${radiusM}:${cat}`;
  const cached = placesCache.get(key);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const result = await placesProvider.searchNearby(lat, lng, radiusM, cat || undefined);
  if (!result.ok) return fail(res, result.error, 'PLACES_UNAVAILABLE');
  placesCache.set(key, result.data);
  return res.json({ success: true, data: result.data });
}

router.get('/places', placesLimiter, (req, res) =>
  handlePlaces(
    {
      lat: Number(req.query.lat),
      lng: Number(req.query.lng),
      radius: Number(req.query.radius),
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      q: typeof req.query.q === 'string' ? req.query.q.trim() : undefined,
    },
    res
  )
);
router.post('/places', placesLimiter, (req, res) =>
  handlePlaces(
    {
      lat: Number(req.body?.lat),
      lng: Number(req.body?.lng),
      radius: Number(req.body?.radius),
      category: typeof req.body?.category === 'string' ? req.body.category : undefined,
      q: typeof req.body?.q === 'string' ? req.body.q.trim() : undefined,
    },
    res
  )
);

// ─── Route ──────────────────────────────────────────────────
router.post('/route', routeLimiter, async (req, res) => {
  const start = req.body?.start || {};
  const end = req.body?.end || {};
  const mode = typeof req.body?.mode === 'string' ? req.body.mode : 'walking';
  if (!validateCoordinates(Number(start.lat), Number(start.lng)) || !validateCoordinates(Number(end.lat), Number(end.lng))) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_COORDINATES', message: 'Coordinates are out of range.' } });
  }
  const s = { lat: Number(start.lat), lng: Number(start.lng) };
  const e = { lat: Number(end.lat), lng: Number(end.lng) };
  const key = `${coarse(s.lat)},${coarse(s.lng)}->${coarse(e.lat)},${coarse(e.lng)}:${mode}`;
  const cached = routeCache.get(key);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const result = await routingProvider.getRoute(s, e, mode);
  if (!result.ok) return fail(res, result.error, 'ROUTE_UNAVAILABLE');
  routeCache.set(key, result.data);
  return res.json({ success: true, data: result.data });
});

export default router;
