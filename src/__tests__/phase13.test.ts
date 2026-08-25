/**
 * EXTROVELA — Phase 13 Automated Test Suite
 * Real-World Intelligence · Provider Client · Weather Scoring · Opening-Hours Guard · Location Resolution
 *
 * Follows the established EXTROVELA pattern (see phase12.test.ts): a single
 * exported `runPhase13Tests()` compiled with esbuild and executed under node with
 * NODE_ENV=test (guarded block at the bottom). There is no test runner in this
 * project. Unlike the earlier suites this one is ASYNC — the provider-client
 * tests await stubbed network calls — so the runner and the self-run block are
 * promise-aware.
 *
 * Everything here exercises the PURE, deterministic core of Phase 13 — the parts
 * whose correctness we can prove WITHOUT a live network, real GPS, or real keys:
 *   · providerClient fail-clean normalizers   (global.fetch is stubbed)
 *   · providerClient in-flight de-duplication
 *   · PersonalizationScorer weather term + additive-equivalence proof
 *   · ConstraintEngine dormant opening-hours guard
 *   · pure locationResolver resolution order
 *
 * IMPORTANT — import targets by DIRECT file path only (never the context/index.ts
 * barrel). Pulling the barrel would drag Capacitor/Firebase into this bare node
 * bundle. providerClient, the scorer, the constraint engine, and locationResolver
 * are all confirmed free of heavy runtime imports.
 *
 * The live external calls (Open-Meteo / Overpass / OSRM), the keyed commercial
 * swaps, and on-device GPS are intentionally NOT executed here — they REQUIRE
 * EXTERNAL CONFIGURATION and are documented in the Phase 13 report. What we prove
 * is the contract every one of them flows through: normalize-or-fail-clean, never
 * fabricate, never throw.
 */

import { fetchWeather, fetchPlaces, fetchRoute } from '../services/providers/providerClient';
import { PersonalizationScorer } from '../quest-engine/scoring/PersonalizationScorer';
import { ConstraintEngine } from '../quest-engine/filters/ConstraintEngine';
import { resolveLocation } from '../services/context/locationResolver';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
}

// ── fetch stubbing helpers ────────────────────────────────────────────────────
// The providerClient uses the global fetch + AbortController + setTimeout (all
// real node globals). We swap only global.fetch so we can drive every branch
// deterministically and prove nothing is fabricated on failure.

interface FetchState {
  calls: number;
  urls: string[];
  inits: Array<RequestInit | undefined>;
}

type FetchHandler = (url: string, init?: RequestInit) => unknown;

function stubFetch(handler: FetchHandler): FetchState {
  const state: FetchState = { calls: 0, urls: [], inits: [] };
  (global as any).fetch = (url: unknown, init?: RequestInit) => {
    state.calls += 1;
    state.urls.push(String(url));
    state.inits.push(init);
    return Promise.resolve().then(() => handler(String(url), init));
  };
  return state;
}

/** A well-formed house envelope: { success:true, data }. */
const okJson = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
/** A well-formed FAILURE envelope: the server reached a provider that failed clean. */
const failEnvelope = () => ({ ok: true, status: 200, json: async () => ({ success: false, error: { code: 'PROVIDER_DOWN', message: 'nope' } }) });
/** An HTTP error (500 / 401 / 503 …). */
const httpErr = (status: number) => ({ ok: false, status, json: async () => ({}) });
/** A 200 whose body cannot be parsed as JSON. */
const malformed = () => ({ ok: true, status: 200, json: async () => { throw new Error('unexpected token < in JSON'); } });

export async function runPhase13Tests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const originalFetch = (global as any).fetch;

  const run = async (test: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      results.push({ test, passed: true });
    } catch (e) {
      results.push({ test, passed: false, error: e instanceof Error ? e.message : String(e) });
    }
  };
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  };

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    //  GROUP A — providerClient: normalize-or-fail-clean, never fabricate/throw
    // ═══════════════════════════════════════════════════════════════════════════

    // ── A1. Success → the normalized data, verbatim ────────────────────────────
    await run('A1. fetchWeather returns the server data on a well-formed success envelope', async () => {
      const weather = { temperatureCelsius: 21, condition: 'clear', precipitationProbability: 0, sunsetTime: '18:30', isGoldenHour: false };
      const s = stubFetch(() => okJson(weather));
      const res = await fetchWeather({ lat: 27.71, lng: 85.32 });
      assert(res !== null, 'a success envelope yields data');
      assert((res as any).temperatureCelsius === 21 && (res as any).condition === 'clear', 'the normalized weather is returned verbatim');
      assert(s.calls === 1, 'exactly one network call');
      assert(s.urls[0].includes('/api/providers/weather') && s.urls[0].includes('lat=27.71'), 'calls the server weather route with coords');
    });

    // ── A2. HTTP 500 → null (never a fabricated default) ───────────────────────
    await run('A2. fetchWeather returns null on HTTP 500 (no fabricated fallback)', async () => {
      stubFetch(() => httpErr(500));
      const res = await fetchWeather({ lat: 1, lng: 1 });
      assert(res === null, 'a 500 fails clean to null, never a mock');
    });

    // ── A3. HTTP 401 auth failure → null ───────────────────────────────────────
    await run('A3. fetchWeather returns null on a 401 auth failure (keyed provider misconfigured)', async () => {
      stubFetch(() => httpErr(401));
      const res = await fetchWeather({ lat: 2, lng: 2 });
      assert(res === null, 'an auth failure fails clean to null');
    });

    // ── A4. success:false envelope → null ──────────────────────────────────────
    await run('A4. fetchWeather returns null on a { success:false } envelope', async () => {
      stubFetch(() => failEnvelope());
      const res = await fetchWeather({ lat: 3, lng: 3 });
      assert(res === null, 'a house failure envelope is treated as no data');
    });

    // ── A5. success:true but no data → null ────────────────────────────────────
    await run('A5. fetchWeather returns null when success is true but data is absent', async () => {
      stubFetch(() => ({ ok: true, status: 200, json: async () => ({ success: true }) }));
      const res = await fetchWeather({ lat: 4, lng: 4 });
      assert(res === null, 'missing data → null, never an empty fabricated object');
    });

    // ── A6. malformed JSON → null ──────────────────────────────────────────────
    await run('A6. fetchWeather returns null when the body is not valid JSON', async () => {
      stubFetch(() => malformed());
      const res = await fetchWeather({ lat: 5, lng: 5 });
      assert(res === null, 'a JSON parse error fails clean to null');
    });

    // ── A7. network error (fetch rejects) → null ───────────────────────────────
    await run('A7. fetchWeather returns null when the network call rejects', async () => {
      (global as any).fetch = () => Promise.reject(new Error('getaddrinfo ENOTFOUND'));
      const res = await fetchWeather({ lat: 6, lng: 6 });
      assert(res === null, 'a network error fails clean to null (offline safety)');
    });

    // ── A8. aborted / timed-out request → null ─────────────────────────────────
    await run('A8. fetchWeather returns null when the request is aborted (timeout path)', async () => {
      (global as any).fetch = () => {
        const err = new Error('The operation was aborted');
        (err as any).name = 'AbortError';
        return Promise.reject(err);
      };
      const res = await fetchWeather({ lat: 7, lng: 7 });
      assert(res === null, 'an abort/timeout fails clean to null');
    });

    // ── A9. invalid coordinates → null WITHOUT touching the network ────────────
    await run('A9. fetchWeather rejects NaN coordinates locally and never calls the network', async () => {
      const s = stubFetch(() => okJson({ temperatureCelsius: 0 }));
      const res = await fetchWeather({ lat: NaN, lng: 10 });
      assert(res === null, 'invalid coords → null');
      assert(s.calls === 0, 'no network call is made for invalid coordinates');
    });

    // ── A10. places success → array; category is URL-encoded ───────────────────
    await run('A10. fetchPlaces returns the array on success and URL-encodes the category', async () => {
      const places = [{ id: 'a', name: 'Cafe A' }, { id: 'b', name: 'Cafe B' }];
      const s = stubFetch(() => okJson(places));
      const res = await fetchPlaces({ lat: 27.7, lng: 85.3 }, 800, 'coffee shop');
      assert(Array.isArray(res) && res.length === 2, 'a places array is returned');
      assert(s.urls[0].includes('radius=800') && s.urls[0].includes('category=coffee%20shop'), 'radius + encoded category are on the query string');
    });

    // ── A11. places non-array data → [] ────────────────────────────────────────
    await run('A11. fetchPlaces returns [] when the payload is not an array', async () => {
      stubFetch(() => okJson({ not: 'an array' }));
      const res = await fetchPlaces({ lat: 8, lng: 8 });
      assert(Array.isArray(res) && res.length === 0, 'a non-array payload normalizes to []');
    });

    // ── A12. places failure → [] ───────────────────────────────────────────────
    await run('A12. fetchPlaces returns [] on an HTTP failure (never a mock list)', async () => {
      stubFetch(() => httpErr(503));
      const res = await fetchPlaces({ lat: 9, lng: 9 });
      assert(Array.isArray(res) && res.length === 0, 'a 503 fails clean to an empty list');
    });

    // ── A13. places invalid coords → [] WITHOUT network ────────────────────────
    await run('A13. fetchPlaces rejects invalid coordinates locally and never calls the network', async () => {
      const s = stubFetch(() => okJson([{ id: 'x' }]));
      const res = await fetchPlaces({ lat: 10, lng: Infinity });
      assert(Array.isArray(res) && res.length === 0, 'invalid coords → []');
      assert(s.calls === 0, 'no network call for invalid coordinates');
    });

    // ── A14. route success → route; POSTed with a body ─────────────────────────
    await run('A14. fetchRoute returns the route on success and POSTs start/end/mode', async () => {
      const route = { distanceMeters: 1234, durationSeconds: 900, mode: 'walking' };
      const s = stubFetch(() => okJson(route));
      const res = await fetchRoute({ lat: 27.71, lng: 85.32 }, { lat: 27.72, lng: 85.33 }, 'walking');
      assert(res !== null && (res as any).distanceMeters === 1234, 'the normalized route is returned');
      assert(s.inits[0]?.method === 'POST', 'route is requested via POST');
      const body = JSON.parse(String(s.inits[0]?.body));
      assert(body.mode === 'walking' && body.start.lat === 27.71 && body.end.lng === 85.33, 'the POST body carries start/end/mode');
    });

    // ── A15. route failure → null ──────────────────────────────────────────────
    await run('A15. fetchRoute returns null on failure', async () => {
      stubFetch(() => httpErr(500));
      const res = await fetchRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 });
      assert(res === null, 'a routing failure fails clean to null');
    });

    // ── A16. route invalid coords → null WITHOUT network ───────────────────────
    await run('A16. fetchRoute rejects invalid endpoints locally and never calls the network', async () => {
      const s = stubFetch(() => okJson({ distanceMeters: 0 }));
      const res = await fetchRoute({ lat: 1, lng: 1 }, { lat: NaN, lng: 2 });
      assert(res === null, 'an invalid endpoint → null');
      assert(s.calls === 0, 'no network call for an invalid endpoint');
    });

    // ── A17. in-flight de-duplication ──────────────────────────────────────────
    await run('A17. two concurrent identical fetchWeather calls hit the network once and share the result', async () => {
      const weather = { temperatureCelsius: 15, condition: 'cloudy' };
      const s = stubFetch(() => okJson(weather));
      // Fire both BEFORE awaiting so the second finds the first in-flight promise.
      const p1 = fetchWeather({ lat: 40.0, lng: 40.0 });
      const p2 = fetchWeather({ lat: 40.0, lng: 40.0 });
      const [r1, r2] = await Promise.all([p1, p2]);
      assert(s.calls === 1, 'a burst of identical requests is de-duplicated to a single fetch');
      assert(r1 === r2, 'both callers receive the very same resolved value');
    });

    // ═══════════════════════════════════════════════════════════════════════════
    //  GROUP B — PersonalizationScorer weather term (additive, 0 without weather)
    // ═══════════════════════════════════════════════════════════════════════════

    // A minimal context whose non-weather terms are fixed, so weather is the only
    // variable across the matrix below. `as any` per the established fixture style.
    const ctx = (weather?: unknown): any => ({
      user: {},
      preferences: { interests: [], socialPreference: 'solo', dislikes: [], typicalAvailableTime: '2 hours' },
      currentRequest: {},
      time: { timeOfDay: 'afternoon' },
      location: {},
      weather,
      nearbyPlaces: [],
      recentQuests: [],
      completedExperiences: [],
      recentCategories: [],
    });
    const cand = (environment: 'Indoor' | 'Outdoor'): any => ({
      environment,
      social: 'Solo',
      tags: [],
      category: 'nature',
      fingerprint: 'fp_test',
      title: 'Test quest',
    });
    const w = (normalizedCondition: string) => ({ normalizedCondition });

    // ── B1. No weather → weatherScore 0 AND finalScore === the legacy formula ──
    await run('B1. With no weather the term is 0 and the final score equals the pre-Phase-13 formula', () => {
      const r: any = PersonalizationScorer.score(cand('Outdoor'), ctx(undefined));
      const b = r.scoreBreakdown;
      assert(b.weatherScore === 0, 'weatherScore is exactly 0 when weather is absent');
      const legacy = Math.max(
        0,
        b.preferenceScore + b.contextScore + b.noveltyScore + b.diversityScore - b.repetitionPenalty - b.dislikePenalty
      );
      assert(b.finalScore === legacy, 'finalScore is byte-identical to the legacy (no-weather) formula');
      assert(r.rawScore === legacy, 'rawScore matches the legacy formula too');
    });

    // ── B2. The term is purely additive — it changes ONLY finalScore, by itself ─
    await run('B2. Adding weather changes the final score by exactly the weather term and nothing else', () => {
      const noWeather: any = PersonalizationScorer.score(cand('Indoor'), ctx(undefined));
      const rain: any = PersonalizationScorer.score(cand('Indoor'), ctx(w('rain')));
      assert(rain.scoreBreakdown.weatherScore === 20, 'rain + Indoor contributes +20');
      assert(
        rain.scoreBreakdown.finalScore === noWeather.scoreBreakdown.finalScore + 20,
        'the final score rises by exactly the weather term; every other term is unchanged'
      );
      // Every non-weather term is provably identical between the two runs.
      for (const k of ['preferenceScore', 'contextScore', 'noveltyScore', 'diversityScore', 'repetitionPenalty', 'dislikePenalty']) {
        assert(rain.scoreBreakdown[k] === noWeather.scoreBreakdown[k], `${k} is unaffected by the weather term`);
      }
    });

    // ── B3. Wet conditions boost Indoor by +20 ─────────────────────────────────
    await run('B3. rain / heavyRain / storm / snow each boost an Indoor candidate by +20', () => {
      for (const c of ['rain', 'heavyRain', 'storm', 'snow']) {
        const r: any = PersonalizationScorer.score(cand('Indoor'), ctx(w(c)));
        assert(r.scoreBreakdown.weatherScore === 20, `${c} + Indoor → +20`);
      }
    });

    // ── B4. Fair conditions boost Outdoor by +15 ───────────────────────────────
    await run('B4. clear / partlyCloudy each boost an Outdoor candidate by +15', () => {
      for (const c of ['clear', 'partlyCloudy']) {
        const r: any = PersonalizationScorer.score(cand('Outdoor'), ctx(w(c)));
        assert(r.scoreBreakdown.weatherScore === 15, `${c} + Outdoor → +15`);
      }
    });

    // ── B5. Non-matching pairings contribute nothing ───────────────────────────
    await run('B5. Mismatched or neutral weather/environment pairings contribute 0', () => {
      const cases: Array<[string, 'Indoor' | 'Outdoor']> = [
        ['rain', 'Outdoor'],       // wet does not boost outdoor
        ['clear', 'Indoor'],       // fair does not boost indoor
        ['cloudy', 'Outdoor'],     // cloudy is neither wet nor fair
        ['fog', 'Indoor'],         // fog is neither
        ['unknown', 'Outdoor'],    // unknown never nudges
        ['extremeHeat', 'Indoor'], // not in the wet set
      ];
      for (const [c, env] of cases) {
        const r: any = PersonalizationScorer.score(cand(env), ctx(w(c)));
        assert(r.scoreBreakdown.weatherScore === 0, `${c} + ${env} → 0`);
      }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    //  GROUP C — ConstraintEngine dormant opening-hours guard
    // ═══════════════════════════════════════════════════════════════════════════

    // A candidate + context that pass EVERY other hard check, so the only reason
    // that can ever appear is the opening-hours guard we are probing.
    const cctx = (): any => ({
      user: {},
      preferences: {},
      currentRequest: {},
      time: {},
      location: {},
      weather: undefined,
      nearbyPlaces: [],
      recentQuests: [],
      completedExperiences: [],
      recentCategories: [],
    });
    const ccand = (boundPlace?: unknown): any => ({
      time: '15 min',
      environment: 'Indoor',
      difficulty: 'Comfort',
      category: 'nature',
      social: 'Solo',
      budget: 'Free',
      tags: [],
      fingerprint: 'fp_c',
      title: 'Constraint quest',
      boundPlace,
    });

    // ── C1. No bound place → the guard never fires (today's default) ───────────
    await run('C1. A candidate with no bound place is valid and never carries bound_place_closed', () => {
      const res = ConstraintEngine.validate(ccand(undefined), cctx());
      assert(res.valid === true, 'the baseline candidate passes every hard check');
      assert(!res.reasons.includes('bound_place_closed'), 'the opening-hours guard is dormant with no bound place');
    });

    // ── C2. A confirmed-closed bound place is rejected (and ONLY for that) ──────
    await run('C2. A bound place that is closed now is rejected with exactly bound_place_closed', () => {
      const res = ConstraintEngine.validate(ccand({ openingStatus: 'closed' }), cctx());
      assert(res.valid === false, 'a closed bound place invalidates the candidate');
      assert(res.reasons.length === 1 && res.reasons[0] === 'bound_place_closed', 'the ONLY rejection reason is the closed place (proves no other check fired)');
    });

    // ── C3. An open bound place is allowed ─────────────────────────────────────
    await run('C3. A bound place that is open is allowed', () => {
      const res = ConstraintEngine.validate(ccand({ openingStatus: 'open' }), cctx());
      assert(res.valid === true && !res.reasons.includes('bound_place_closed'), "openingStatus 'open' never blocks");
    });

    // ── C4. An unknown status never blocks (we only reject on a confirmed close) ─
    await run('C4. A bound place with unknown hours is allowed (we reject only on a confirmed close)', () => {
      const res = ConstraintEngine.validate(ccand({ openingStatus: 'unknown' }), cctx());
      assert(res.valid === true && !res.reasons.includes('bound_place_closed'), "openingStatus 'unknown' never blocks");
    });

    // ═══════════════════════════════════════════════════════════════════════════
    //  GROUP D — pure locationResolver resolution order (never fabricates)
    // ═══════════════════════════════════════════════════════════════════════════

    const KTM = { city: 'Kathmandu', country: 'Nepal', coords: { lat: 27.7172, lng: 85.324 } };

    // ── D1. An explicit request coordinate wins over everything ────────────────
    await run('D1. A valid request coordinate resolves to gps and outranks a city center', () => {
      const req = { lat: 12.34, lng: 56.78 };
      const r = resolveLocation({ requestLocation: req, cityCenter: KTM });
      assert(r.available && r.source === 'gps', 'a request coordinate is treated as a device-origin gps fix');
      assert(r.coords === req, 'the exact request coordinate is used (not the city center)');
    });

    // ── D2. An invalid request falls through to a granted GPS fix ──────────────
    await run('D2. An invalid request coordinate is skipped; a granted GPS fix is used', () => {
      const gps = { lat: 27.7, lng: 85.3 };
      const r = resolveLocation({ requestLocation: { lat: NaN, lng: 1 }, permissionState: 'granted', gpsResult: gps });
      assert(r.available && r.source === 'gps' && r.coords === gps, 'the granted GPS fix resolves when the request is unusable');
    });

    // ── D3. GPS is used only when permission is granted ────────────────────────
    await run('D3. A granted GPS fix resolves when there is no request coordinate', () => {
      const gps = { lat: 51.5, lng: -0.12 };
      const r = resolveLocation({ permissionState: 'granted', gpsResult: gps });
      assert(r.available && r.source === 'gps' && r.coords === gps, 'granted + a valid fix → gps');
    });

    // ── D4. A denied permission never consumes a GPS fix ───────────────────────
    await run('D4. With permission denied the GPS fix is ignored and it falls back to the manual city', () => {
      const gps = { lat: 51.5, lng: -0.12 };
      const r = resolveLocation({ permissionState: 'denied', gpsResult: gps, cityCenter: KTM });
      assert(r.source === 'manual', 'a denied permission must not turn a stray fix into a gps result');
      assert(r.coords === KTM.coords && r.city === 'Kathmandu' && r.country === 'Nepal', 'it resolves to the manual city center instead');
    });

    // ── D5. No GPS fix + a chosen city → manual, carrying the label ────────────
    await run('D5. Granted permission but no fix falls back to the manual city center with its label', () => {
      const r = resolveLocation({ permissionState: 'granted', gpsResult: null, cityCenter: KTM });
      assert(r.available && r.source === 'manual', 'no fix → manual');
      assert(r.city === 'Kathmandu' && r.country === 'Nepal', 'the human-readable city/country label is carried through');
    });

    // ── D6. A chosen city alone resolves to manual ─────────────────────────────
    await run('D6. A city center alone resolves to a manual location', () => {
      const r = resolveLocation({ cityCenter: KTM });
      assert(r.available && r.source === 'manual' && r.coords === KTM.coords, 'a manual city selection is usable');
    });

    // ── D7. Nothing usable → an explicit "none" (never a fabricated city) ──────
    await run('D7. With no usable input the resolver reports none and fabricates nothing', () => {
      const r = resolveLocation({});
      assert(r.available === false && r.source === 'none', 'no location is reported as none, not a default city');
      assert(r.coords === undefined, 'no coordinates are invented');
    });

    // ── D8. A city center with invalid coords is not usable ────────────────────
    await run('D8. A malformed city center is rejected rather than trusted', () => {
      const bad = { city: 'Nowhere', country: '', coords: { lat: NaN, lng: NaN } };
      const r = resolveLocation({ cityCenter: bad });
      assert(r.available === false && r.source === 'none', 'an invalid city center coordinate is not treated as a location');
    });
  } finally {
    // Always restore the real fetch, even if an assertion threw mid-group.
    (global as any).fetch = originalFetch;
  }

  return results;
}

// Guarded self-run: compiled with esbuild and executed under node with
// NODE_ENV=test. Mirrors the Phase 7–12 suites, but awaits the async runner.
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  // eslint-disable-next-line no-console
  console.log('Running Phase 13 automated tests...');
  runPhase13Tests()
    .then(res => {
      const failed = res.filter(r => !r.passed);
      // eslint-disable-next-line no-console
      console.log('Test Results:', JSON.stringify(res, null, 2));
      // eslint-disable-next-line no-console
      console.log(`Phase 13: ${res.length - failed.length}/${res.length} passed.`);
      if (failed.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`${failed.length} test(s) FAILED.`);
        process.exitCode = 1;
      }
    })
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error('Phase 13 suite crashed:', err);
      process.exitCode = 1;
    });
}
