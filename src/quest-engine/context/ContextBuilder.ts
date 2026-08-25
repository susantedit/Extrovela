/**
 * EXTROVELA — Quest Engine Context Builder (Phase 6)
 * 
 * Synthesizes active user request, stored preferences, live weather conditions,
 * sunset countdown, and nearby open places.
 */

import { EngineContext, QuestRequest, TimeContext, LocationContext, TimeOfDay } from '../types';
import { UserProfile, UserPreferences } from '../../types/user';
import { Quest, QuestAttempt } from '../../types/quest';
import { Coordinates } from '../../types/place';
import { weatherService, WeatherContextInfo } from '../../services/context/weatherService';
import { placesService, PlaceWithContext } from '../../services/context/placesService';
import { locationService, LocationPermissionState } from '../../services/context/locationService';
import { resolveLocation, ResolvedLocation } from '../../services/context/locationResolver';
import { getCityCenter, nearestCity } from '../../config/cityCenters';

export class ContextBuilder {
  static getTimeContext(now: Date = new Date(), sunsetInfo?: { minutesUntil?: number; minutesSince?: number }): TimeContext {
    const hours = now.getHours();
    let timeOfDay: TimeOfDay = 'afternoon';

    if (hours >= 5 && hours < 8) timeOfDay = 'earlyMorning';
    else if (hours >= 8 && hours < 12) timeOfDay = 'morning';
    else if (hours >= 12 && hours < 17) timeOfDay = 'afternoon';
    else if (hours >= 17 && hours < 20) timeOfDay = 'evening';
    else if (hours >= 20 && hours < 23) timeOfDay = 'night';
    else timeOfDay = 'lateNight';

    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';

    const month = now.getMonth();
    const season = month >= 4 && month <= 9 ? 'Garimahina (Summer)' : 'Jadamahina (Winter)';

    return {
      localDate: now.toISOString().split('T')[0],
      localTime: now.toTimeString().split(' ')[0],
      dayOfWeek,
      timeOfDay,
      isWeekend,
      season,
      minutesUntilSunset: sunsetInfo?.minutesUntil ?? (timeOfDay === 'afternoon' ? 120 : timeOfDay === 'evening' ? 25 : undefined),
      minutesSinceSunset: sunsetInfo?.minutesSince,
    };
  }

  /** Synchronous, request-only location resolution (no GPS/network). */
  static getLocationContext(request: QuestRequest, _prefs: UserPreferences): LocationContext {
    return this.toLocationContext(resolveLocation({ requestLocation: request.location ?? null }));
  }

  /**
   * Gathers permission + GPS (async, NON-prompting) then applies the pure
   * resolver. Only reads an already-granted permission — quest generation must
   * never trigger a permission dialog.
   */
  private static async resolveLocationAsync(
    request: QuestRequest,
    manualCity?: string
  ): Promise<ResolvedLocation> {
    const requestLocation = request.location ?? null;

    let permissionState: LocationPermissionState = 'unknown';
    let gpsResult: Coordinates | null = null;

    if (!requestLocation) {
      try {
        permissionState = await locationService.checkPermission();
        if (permissionState === 'granted') {
          const fix = await locationService.getCurrentLocation();
          gpsResult = fix?.coordinates ?? null;
        }
      } catch {
        permissionState = 'unknown';
        gpsResult = null;
      }
    }

    const cityCenter = manualCity ? getCityCenter(manualCity) ?? null : null;
    return resolveLocation({ requestLocation, permissionState, gpsResult, cityCenter });
  }

  /** Maps a ResolvedLocation to LocationContext, labeling the city WITHOUT hardcoding one. */
  private static toLocationContext(resolved: ResolvedLocation): LocationContext {
    const coords = resolved.coords;
    const near = coords ? nearestCity(coords) : undefined;
    return {
      latitude: coords?.lat ?? 0,
      longitude: coords?.lng ?? 0,
      city: resolved.city ?? near?.city ?? '',
      country: resolved.country ?? near?.country ?? '',
      source: resolved.source,
      available: resolved.available,
    };
  }

  static async buildContextAsync(params: {
    user: UserProfile;
    preferences: UserPreferences;
    request: QuestRequest;
    recentQuests?: Quest[];
    completedExperiences?: QuestAttempt[];
    manualCity?: string;
  }): Promise<EngineContext> {
    const resolved = await this.resolveLocationAsync(params.request, params.manualCity);
    const location = this.toLocationContext(resolved);

    // Only enrich with real-world data when we actually have a location. Both
    // calls are fail-clean: weather → null, places → [] if a provider is down,
    // gated off, or the location is unavailable. Nothing is fabricated.
    let weather: WeatherContextInfo | null = null;
    let places: PlaceWithContext[] = [];
    if (resolved.available && resolved.coords) {
      [weather, places] = await Promise.all([
        weatherService.getWeatherContext(resolved.coords),
        placesService.getNearbyPlaces(resolved.coords),
      ]);
    }

    const time = this.getTimeContext(new Date(), {
      minutesUntil: weather?.minutesUntilSunset,
      minutesSince: weather?.minutesSinceSunset,
    });

    const recentCategories = (params.recentQuests || []).map(q => q.category);

    return {
      user: params.user,
      preferences: params.preferences,
      currentRequest: params.request,
      time,
      location,
      // undefined (not null) to satisfy EngineContext.weather?: WeatherContextInfo
      weather: weather ?? undefined,
      // Real nearby places (Phase 13) when available, else []. These are for
      // ranking/awareness only and MUST NOT be surfaced as unverified place
      // names in AI quest text (AI grounding rule).
      nearbyPlaces: places,
      recentQuests: params.recentQuests || [],
      completedExperiences: params.completedExperiences || [],
      recentCategories,
    };
  }

  static buildContext(params: {
    user: UserProfile;
    preferences: UserPreferences;
    request: QuestRequest;
    recentQuests?: Quest[];
    completedExperiences?: QuestAttempt[];
  }): EngineContext {
    // Synchronous fallback (used when the async pipeline throws): request-only
    // location, no GPS/network. Still produces a valid, non-crashing context.
    const location = this.toLocationContext(
      resolveLocation({ requestLocation: params.request.location ?? null })
    );
    const time = this.getTimeContext();
    const recentCategories = (params.recentQuests || []).map(q => q.category);

    return {
      user: params.user,
      preferences: params.preferences,
      currentRequest: params.request,
      time,
      location,
      recentQuests: params.recentQuests || [],
      completedExperiences: params.completedExperiences || [],
      recentCategories,
    };
  }
}
