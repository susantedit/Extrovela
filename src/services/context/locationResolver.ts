/**
 * EXTROVELA — Phase 13: Location Resolver (pure)
 *
 * Decides WHICH location a quest context should use, given already-gathered
 * inputs. Deliberately pure and side-effect-free: it does NOT call GPS, storage,
 * or the network — the caller (ContextBuilder) gathers those first and passes
 * them in. That keeps this the unit-testable core of the resolution order and
 * keeps Capacitor/Firebase out of any bundle that imports it.
 *
 * Resolution order (first match wins):
 *   1. an explicit coordinate on the request (device-origin)          → 'gps'
 *   2. a fresh device GPS fix, ONLY when permission is already granted → 'gps'
 *   3. a user-chosen city center (manual selection)                    → 'manual'
 *   4. nothing usable                                                  → 'none'
 *
 * We NEVER invent coordinates. 'none' means "no location" — the caller must then
 * skip location-dependent enrichment rather than fall back to a hardcoded city.
 */

import type { Coordinates } from '../../types/place';
import type { LocationPermissionState } from './locationService';
import type { CityCenter } from '../../config/cityCenters';

export type ResolvedLocationSource = 'gps' | 'manual' | 'none';

export interface ResolvedLocation {
  available: boolean;
  source: ResolvedLocationSource;
  coords?: Coordinates;
  city?: string;
  country?: string;
}

export interface LocationResolverInput {
  requestLocation?: Coordinates | null;
  permissionState?: LocationPermissionState;
  gpsResult?: Coordinates | null;
  cityCenter?: CityCenter | null;
}

function isValidCoords(c?: Coordinates | null): c is Coordinates {
  return !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);
}

export function resolveLocation(input: LocationResolverInput): ResolvedLocation {
  const { requestLocation, permissionState, gpsResult, cityCenter } = input;

  // 1. Explicit request coordinate wins.
  if (isValidCoords(requestLocation)) {
    return { available: true, source: 'gps', coords: requestLocation };
  }

  // 2. Device GPS — only when permission is ALREADY granted (never force a prompt
  //    during quest generation) and we actually got a fix.
  if (permissionState === 'granted' && isValidCoords(gpsResult)) {
    return { available: true, source: 'gps', coords: gpsResult };
  }

  // 3. User-chosen city center (manual selection).
  if (cityCenter && isValidCoords(cityCenter.coords)) {
    return {
      available: true,
      source: 'manual',
      coords: cityCenter.coords,
      city: cityCenter.city,
      country: cityCenter.country,
    };
  }

  // 4. No usable location. Do NOT fabricate one.
  return { available: false, source: 'none' };
}
