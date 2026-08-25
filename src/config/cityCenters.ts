/**
 * EXTROVELA — Phase 13: Shared City Centers
 *
 * A small city → center-coordinate lookup shared by the map (LifeMap) and the
 * manual-location fallback in the quest engine. Extracted so both agree on ONE
 * table instead of hardcoding the same coordinates in two files. This is a
 * convenience lookup for labeling/centering — never a substitute for real GPS.
 */

import type { Coordinates } from '../types/place';

export interface CityCenter {
  city: string;
  country: string;
  coords: Coordinates;
}

// [lat, lng] tuples keep the exact shape LifeMap's Leaflet `center` already uses.
export const CITY_CENTERS: Record<string, [number, number]> = {
  Kathmandu: [27.7172, 85.324],
  Pokhara: [28.2096, 83.9575],
  Tokyo: [35.6762, 139.6503],
  London: [51.5074, -0.1278],
};

const CITY_COUNTRY: Record<string, string> = {
  Kathmandu: 'Nepal',
  Pokhara: 'Nepal',
  Tokyo: 'Japan',
  London: 'United Kingdom',
};

/** Map default center used only for the always-on map view, never for the engine. */
export const DEFAULT_MAP_CITY = 'Kathmandu';

export function getCityCenter(city?: string | null): CityCenter | undefined {
  if (!city) return undefined;
  const tuple = CITY_CENTERS[city];
  if (!tuple) return undefined;
  return { city, country: CITY_COUNTRY[city] || '', coords: { lat: tuple[0], lng: tuple[1] } };
}

function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Nearest known city within `maxKm`, used to give raw GPS coordinates a human
 * city label WITHOUT hardcoding one city. Returns undefined when nothing in the
 * table is close enough — the caller then leaves the city blank rather than lying.
 */
export function nearestCity(coords: Coordinates, maxKm = 80): CityCenter | undefined {
  let best: CityCenter | undefined;
  let bestKm = Infinity;
  for (const [name, tuple] of Object.entries(CITY_CENTERS)) {
    const c = { lat: tuple[0], lng: tuple[1] };
    const km = haversineKm(coords, c);
    if (km < bestKm) {
      bestKm = km;
      best = { city: name, country: CITY_COUNTRY[name] || '', coords: c };
    }
  }
  return best && bestKm <= maxKm ? best : undefined;
}
