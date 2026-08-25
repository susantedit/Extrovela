/**
 * EXTROVELA — Weather Service & Sunset Intelligence Engine (Phase 6)
 * 
 * Manages atmospheric conditions, golden-hour sunset calculations, weather safety rules, and caching.
 */

import { Coordinates } from '../../types/place';
import { WeatherData } from '../providers/interfaces';
import { mockWeather } from '../providers/mockProviders';
import { providerClient } from '../providers/providerClient';
import { isFeatureEnabled } from '../../config/featureFlags';
import { config } from '../../config/env';
import logger from '../../utils/logger';

export type NormalizedWeatherCondition =
  | 'clear'
  | 'partlyCloudy'
  | 'cloudy'
  | 'rain'
  | 'heavyRain'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'extremeHeat'
  | 'extremeCold'
  | 'unknown';

export interface WeatherContextInfo extends WeatherData {
  normalizedCondition: NormalizedWeatherCondition;
  minutesUntilSunset?: number;
  minutesSinceSunset?: number;
  isSafeForExposedOutdoor: boolean;
}

export class WeatherService {
  private cache: Map<string, { data: WeatherContextInfo; timestamp: number }> = new Map();
  private CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute cache

  /**
   * Returns normalized weather for a point, or `null` when real weather is
   * unavailable (provider down, feature gated off, or bad data). Callers MUST
   * treat null as "weather unknown" — there is deliberately no fabricated
   * fallback, so a production app never presents invented conditions.
   */
  async getWeatherContext(coords: Coordinates): Promise<WeatherContextInfo | null> {
    const cacheKey = `${coords.lat.toFixed(2)}_${coords.lng.toFixed(2)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const raw = await this.fetchRaw(coords);
    if (!raw) return null; // fail clean — never invent weather

    try {
      const normalizedCondition = this.normalizeCondition(raw.condition);
      const sunsetCalc = this.calculateSunsetMinutes(raw.sunsetTime);

      const info: WeatherContextInfo = {
        ...raw,
        normalizedCondition,
        minutesUntilSunset: sunsetCalc.minutesUntil,
        minutesSinceSunset: sunsetCalc.minutesSince,
        isSafeForExposedOutdoor: this.isOutdoorSafe(normalizedCondition, raw.temperatureCelsius),
      };

      this.cache.set(cacheKey, { data: info, timestamp: Date.now() });
      return info;
    } catch (err) {
      logger.error('Failed to normalize weather context', err);
      return null;
    }
  }

  /**
   * Source selection. Dev-only mock (hard-blocked in production, see env.ts) OR
   * the real server-mediated provider, gated by the `realWeather` master flag.
   * Returns null on any failure — never a hardcoded default.
   */
  private async fetchRaw(coords: Coordinates): Promise<WeatherData | null> {
    if (config.features.mockProviders) {
      try {
        return await mockWeather.getWeatherAtCoordinates(coords);
      } catch (err) {
        logger.error('Mock weather failed', err);
        return null;
      }
    }
    if (!isFeatureEnabled('realWeather')) return null;
    return providerClient.fetchWeather(coords);
  }

  private normalizeCondition(cond: string): NormalizedWeatherCondition {
    const lower = cond.toLowerCase();
    if (lower.includes('storm')) return 'storm';
    if (lower.includes('heavy rain') || lower.includes('downpour')) return 'heavyRain';
    if (lower.includes('rain')) return 'rain';
    if (lower.includes('snow')) return 'snow';
    if (lower.includes('fog') || lower.includes('mist')) return 'fog';
    if (lower.includes('cloud')) return 'cloudy';
    if (lower.includes('clear')) return 'clear';
    return 'unknown';
  }

  private calculateSunsetMinutes(sunsetTimeStr: string): { minutesUntil?: number; minutesSince?: number } {
    const [h, m] = sunsetTimeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return {};

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const sunsetMinutes = h * 60 + m;

    const diff = sunsetMinutes - currentMinutes;
    if (diff > 0) {
      return { minutesUntil: diff };
    } else {
      return { minutesSince: Math.abs(diff) };
    }
  }

  // ─── Weather Safety Engine ──────────────────────────────────
  private isOutdoorSafe(condition: NormalizedWeatherCondition, temp: number): boolean {
    if (condition === 'storm' || condition === 'heavyRain') return false;
    if (temp > 40 || temp < -5) return false;
    return true;
  }
}

export const weatherService = new WeatherService();
export default weatherService;
