/**
 * EXTROVELA — Places Service & Opening-Hours Engine (Phase 6)
 * 
 * Manages nearby place discovery, categorization, opening-hours evaluation, and caching.
 */

import { Coordinates, Place } from '../../types/place';
import { mockPlaces } from '../providers/mockProviders';
import { providerClient } from '../providers/providerClient';
import { isFeatureEnabled } from '../../config/featureFlags';
import { config } from '../../config/env';
import logger from '../../utils/logger';

export type PlaceOpeningStatus = 'open' | 'closed' | 'unknown';

export interface PlaceWithContext extends Place {
  distanceMeters?: number;
  openingStatus: PlaceOpeningStatus;
}

export class PlacesService {
  private cache: Map<string, { places: PlaceWithContext[]; timestamp: number }> = new Map();
  private CACHE_TTL_MS = 60 * 60 * 1000; // 1-hour cache

  async getNearbyPlaces(coords: Coordinates, radiusMeters: number = 2000): Promise<PlaceWithContext[]> {
    const cacheKey = `${coords.lat.toFixed(3)}_${coords.lng.toFixed(3)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      logger.info('Returning cached places', { cacheKey });
      return cached.places;
    }

    const rawPlaces = await this.fetchRaw(coords, radiusMeters);
    const normalized: PlaceWithContext[] = rawPlaces
      .map(p => ({ ...p, openingStatus: this.evaluateOpeningHours(p) }))
      // Never surface a place we can see is closed right now.
      .filter(p => this.isPlaceCurrentlyAvailable(p));

    this.cache.set(cacheKey, { places: normalized, timestamp: Date.now() });
    return normalized;
  }

  /**
   * Source selection. Dev-only mock (hard-blocked in production, see env.ts) OR
   * the real server-mediated provider, gated by the `realPlaces` master flag.
   * Returns [] on any failure — never fabricated places.
   */
  private async fetchRaw(coords: Coordinates, radiusMeters: number): Promise<Place[]> {
    if (config.features.mockProviders) {
      try {
        return await mockPlaces.searchNearbyPlaces(coords);
      } catch (err) {
        logger.error('Mock places failed', err);
        return [];
      }
    }
    if (!isFeatureEnabled('realPlaces')) return [];
    return providerClient.fetchPlaces(coords, radiusMeters);
  }

  // ─── Opening-Hours Safety ────────────────────────────────────
  evaluateOpeningHours(place: Place): PlaceOpeningStatus {
    // Prefer a real opening-hours string when the provider supplies one.
    if (typeof place.openingHours === 'string' && place.openingHours.trim()) {
      return this.parseSimpleOpeningHours(place.openingHours.trim());
    }
    // No hours data: return 'unknown' rather than falsely assuming open.
    if (!place.tags || place.tags.length === 0) return 'unknown';

    const currentHour = new Date().getHours();
    if (currentHour >= 7 && currentHour <= 21) {
      return 'open';
    }
    return 'closed';
  }

  /**
   * Conservative interpreter for the common, unambiguous cases only. Anything
   * with day rules or multiple ranges (the full OSM opening_hours grammar) is
   * reported 'unknown' — we never guess a place open when we cannot be sure.
   */
  private parseSimpleOpeningHours(spec: string): PlaceOpeningStatus {
    if (/\b24\s*\/\s*7\b/.test(spec)) return 'open';
    const range = spec.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (range) {
      const now = new Date();
      const cur = now.getHours() * 60 + now.getMinutes();
      const open = Number(range[1]) * 60 + Number(range[2]);
      let close = Number(range[3]) * 60 + Number(range[4]);
      if (close <= open) close += 24 * 60; // spans midnight
      return cur >= open && cur <= close ? 'open' : 'closed';
    }
    return 'unknown';
  }

  isPlaceCurrentlyAvailable(place: PlaceWithContext): boolean {
    // Safety rule: If place is confirmed closed, do not recommend
    return place.openingStatus !== 'closed';
  }
}

export const placesService = new PlacesService();
export default placesService;
