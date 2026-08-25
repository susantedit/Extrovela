/**
 * EXTROVELA — Phase 13: Weather Provider (server-side)
 *
 * Real weather behind a provider abstraction. The keyless default is Open-Meteo
 * (no API key, real data). Set WEATHER_PROVIDER=openweather + OPENWEATHER_API_KEY
 * to swap in a commercial provider without touching any caller.
 *
 * Mirrors server/services/ai/geminiProvider.js: isConfigured() gate, scrub() so a
 * key never reaches a log, AbortController timeout, and a { ok, data, error,
 * retryable } result that NEVER throws. Output is normalized to the internal
 * WeatherData model (src/services/providers/interfaces.ts) — raw provider JSON
 * never leaves this file.
 */

const OPEN_METEO_ENDPOINT = process.env.OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast';
const OPENWEATHER_ENDPOINT = 'https://api.openweathermap.org/data/2.5/weather';
const DEFAULT_TIMEOUT_MS = 8000;

function selectedProvider() {
  return (process.env.WEATHER_PROVIDER || 'open-meteo').toLowerCase();
}

/** True when the selected provider can actually serve requests. Open-Meteo is keyless. */
export function isConfigured() {
  const provider = selectedProvider();
  if (provider === 'openweather') {
    const key = process.env.OPENWEATHER_API_KEY;
    return Boolean(key && key !== 'YOUR_OPENWEATHER_API_KEY' && key.length > 10);
  }
  return true; // open-meteo (default) needs no key
}

/** Redacts any configured key from strings we might log. */
function scrub(message) {
  const key = process.env.OPENWEATHER_API_KEY;
  let out = String(message || '');
  if (key && key.length > 6) out = out.split(key).join('[REDACTED_KEY]');
  return out.replace(/appid=[^&\s]+/gi, 'appid=[REDACTED]').replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
}

/** WMO weather code → internal WeatherData.condition union. */
function mapWmoCode(code) {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'mist';
  if (code >= 51 && code <= 67) return 'rain'; // drizzle + rain
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain'; // rain showers
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm'; // thunderstorm
  return 'cloudy';
}

/** OpenWeather `weather[0].main` → internal union (keyed-provider path). */
function mapOpenWeatherMain(main) {
  const m = String(main || '').toLowerCase();
  if (m === 'clear') return 'clear';
  if (m === 'clouds') return 'cloudy';
  if (m === 'rain' || m === 'drizzle') return 'rain';
  if (m === 'snow') return 'snow';
  if (m === 'thunderstorm') return 'storm';
  if (['mist', 'fog', 'haze', 'smoke'].includes(m)) return 'mist';
  return 'cloudy';
}

/** '2026-08-24T18:45' (local when timezone=auto) → 'HH:MM'. */
function hhmmFromIso(iso) {
  if (typeof iso !== 'string') return '';
  const timePart = iso.split('T')[1] || '';
  return timePart.slice(0, 5);
}

function minutesFromHhmm(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** UNIX seconds → 'HH:MM' in the given IANA timezone (OpenWeather path). */
function hhmmFromUnix(unixSeconds, timezoneOffsetSeconds = 0) {
  const d = new Date((unixSeconds + timezoneOffsetSeconds) * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export class WeatherProvider {
  constructor(options = {}) {
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.name = 'weather';
  }

  isAvailable() {
    return isConfigured();
  }

  /**
   * @returns {Promise<{ok:boolean, data?:object, latencyMs:number, error?:string, retryable?:boolean}>}
   * data is a normalized WeatherData. Never throws.
   */
  async getWeather(lat, lng) {
    if (!this.isAvailable()) {
      return { ok: false, latencyMs: 0, error: 'weather_not_configured' };
    }
    if (selectedProvider() === 'openweather') {
      return this.#fetchOpenWeather(lat, lng);
    }
    return this.#fetchOpenMeteo(lat, lng);
  }

  async #fetchOpenMeteo(lat, lng) {
    const url =
      `${OPEN_METEO_ENDPOINT}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}` +
      '&current=temperature_2m,precipitation,weather_code,relative_humidity_2m,wind_speed_10m' +
      '&hourly=precipitation_probability&daily=sunrise,sunset&timezone=auto&forecast_days=1';
    return this.#request(url, {}, (data) => {
      const current = data?.current || {};
      const daily = data?.daily || {};
      const sunsetIso = Array.isArray(daily.sunset) ? daily.sunset[0] : undefined;
      const sunsetTime = hhmmFromIso(sunsetIso);

      // Precipitation probability aligned to the current hour when available.
      let precipitationProbability = 0;
      const probs = data?.hourly?.precipitation_probability;
      const times = data?.hourly?.time;
      if (Array.isArray(probs) && probs.length) {
        let idx = 0;
        if (Array.isArray(times) && typeof current.time === 'string') {
          const found = times.indexOf(current.time);
          if (found >= 0) idx = found;
        }
        precipitationProbability = Number(probs[idx]) || 0;
      }

      const sunsetMin = minutesFromHhmm(sunsetTime);
      const nowMin = minutesFromHhmm(hhmmFromIso(current.time));
      const isGoldenHour =
        sunsetMin != null && nowMin != null && nowMin >= sunsetMin - 90 && nowMin <= sunsetMin;

      return {
        temperatureCelsius: Number(current.temperature_2m),
        condition: mapWmoCode(Number(current.weather_code)),
        precipitationProbability,
        sunsetTime,
        isGoldenHour,
      };
    });
  }

  async #fetchOpenWeather(lat, lng) {
    const key = process.env.OPENWEATHER_API_KEY;
    const url = `${OPENWEATHER_ENDPOINT}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&units=metric&appid=${key}`;
    return this.#request(url, {}, (data) => {
      const tzOffset = Number(data?.timezone) || 0;
      const sunsetTime = data?.sys?.sunset ? hhmmFromUnix(Number(data.sys.sunset), tzOffset) : '';
      const nowTime = hhmmFromUnix(Math.floor(Date.now() / 1000), tzOffset);
      const sunsetMin = minutesFromHhmm(sunsetTime);
      const nowMin = minutesFromHhmm(nowTime);
      return {
        temperatureCelsius: Number(data?.main?.temp),
        condition: mapOpenWeatherMain(data?.weather?.[0]?.main),
        precipitationProbability:
          typeof data?.pop === 'number' ? Math.round(data.pop * 100) : 0,
        sunsetTime,
        isGoldenHour:
          sunsetMin != null && nowMin != null && nowMin >= sunsetMin - 90 && nowMin <= sunsetMin,
      };
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
          error: `weather_http_${response.status}`,
          retryable: response.status === 429 || response.status >= 500,
        };
      }
      const raw = await response.json();
      const data = normalize(raw);
      if (!data || !Number.isFinite(data.temperatureCelsius)) {
        return { ok: false, latencyMs, error: 'weather_malformed_response' };
      }
      return { ok: true, data, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const aborted = err?.name === 'AbortError';
      return {
        ok: false,
        latencyMs,
        error: aborted ? 'weather_timeout' : 'weather_network_error',
        detail: scrub(err?.message).slice(0, 160),
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const weatherProvider = new WeatherProvider();
export default weatherProvider;
