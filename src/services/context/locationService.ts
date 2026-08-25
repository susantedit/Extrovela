/**
 * EXTROVELA — Location Service & Privacy Engine (Phase 6)
 * 
 * Provides on-demand GPS coordinates with strict privacy boundaries:
 * - No continuous tracking
 * - Privacy redaction for AI and analytics
 * - Robust permission state handling
 */

import { Geolocation, Position } from '@capacitor/geolocation';
import { Coordinates } from '../../types/place';
import { analytics } from '../firebase/firebaseAnalytics';
import logger from '../../utils/logger';

export type LocationPermissionState = 'unknown' | 'granted' | 'denied' | 'restricted' | 'unavailable';

export interface CurrentLocationResult {
  coordinates: Coordinates;
  accuracyMeters: number;
  timestamp: string;
  isFuzzed: boolean;
}

export class LocationService {
  private lastKnownLocation: CurrentLocationResult | null = null;

  async checkPermission(): Promise<LocationPermissionState> {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location === 'granted') return 'granted';
      if (status.location === 'denied') return 'denied';
    } catch {
      // Fall through to web permission query
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const res = await navigator.permissions.query({ name: 'geolocation' });
          if (res.state === 'granted') return 'granted';
          if (res.state === 'denied') return 'denied';
        } catch {
          // Ignore
        }
      }
      return 'granted';
    }

    return 'unknown';
  }

  async requestPermission(): Promise<LocationPermissionState> {
    try {
      analytics.trackEvent('location_permission_prompted');
      const status = await Geolocation.requestPermissions();
      const granted = status.location === 'granted';
      if (granted) {
        analytics.trackEvent('location_permission_granted');
        return 'granted';
      }
    } catch {
      // Fall through to web prompt
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      return new Promise<LocationPermissionState>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            analytics.trackEvent('location_permission_granted');
            resolve('granted');
          },
          () => {
            analytics.trackEvent('location_permission_denied');
            resolve('denied');
          },
          { timeout: 8000 }
        );
      });
    }

    return 'denied';
  }

  async getCurrentLocation(): Promise<CurrentLocationResult | null> {
    // 1. Try Capacitor Native GPS
    try {
      const pos: Position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      });

      const result: CurrentLocationResult = {
        coordinates: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        },
        accuracyMeters: pos.coords.accuracy || 50,
        timestamp: new Date(pos.timestamp).toISOString(),
        isFuzzed: false,
      };

      this.lastKnownLocation = result;
      return result;
    } catch {
      // Fall through to standard Web Geolocation API
    }

    // 2. Standard HTML5 Web Geolocation API Fallback
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const webPos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          });
        });

        const result: CurrentLocationResult = {
          coordinates: {
            lat: webPos.coords.latitude,
            lng: webPos.coords.longitude,
          },
          accuracyMeters: webPos.coords.accuracy || 50,
          timestamp: new Date(webPos.timestamp).toISOString(),
          isFuzzed: false,
        };

        this.lastKnownLocation = result;
        return result;
      } catch (err) {
        logger.warn('[EXTROVELA Location] Web Geolocation failed or permission denied', { err });
      }
    }

    return null;
  }

  /**
   * Reverse Geocode Lat/Lng to City Name via Free OpenStreetMap Nominatim
   */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        const address = data.address || {};
        const city = address.city || address.town || address.village || address.suburb || address.county || address.state;
        if (city) return city;
      }
    } catch {
      // Fail clean fallback
    }
    return null;
  }

  // ─── Privacy Redaction ──────────────────────────────────────
  static sanitizeLocationForAI(coords: Coordinates, city: string = 'Kathmandu'): { city: string; areaDescription: string } {
    // Never send exact raw GPS to AI model
    return {
      city,
      areaDescription: `${city} Central Exploration District`,
    };
  }

  static sanitizeLocationForAnalytics(city: string = 'Kathmandu'): { city: string } {
    // Only send broad city name, never coordinates
    return { city };
  }
}

export const locationService = new LocationService();
export default locationService;
