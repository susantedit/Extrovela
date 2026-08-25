/**
 * EXTROVELA — External API Provider Interfaces (Phase 4)
 * 
 * Abstract contracts isolating external third-party services (AI, Weather, Places, Events, Maps)
 * so the product core remains completely decoupled from specific vendor SDKs.
 */

import { Coordinates, Place } from '../../types/place';
import { Quest } from '../../types/quest';

export interface WeatherData {
  temperatureCelsius: number;
  condition: 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'mist';
  precipitationProbability: number;
  sunsetTime: string;
  isGoldenHour: boolean;
}

export interface WeatherProvider {
  getWeatherAtCoordinates(coords: Coordinates): Promise<WeatherData>;
  getSunsetTime(city: string): Promise<string>;
}

export interface PlaceSearchParams {
  category?: string;
  radiusMeters?: number;
  openNow?: boolean;
  priceLevel?: number;
}

export interface PlacesProvider {
  searchNearbyPlaces(coords: Coordinates, params?: PlaceSearchParams): Promise<Place[]>;
  getPlaceDetails(placeId: string): Promise<Place | null>;
}

export interface LocalEvent {
  id: string;
  title: string;
  category: string;
  startTime: string;
  endTime?: string;
  venueName: string;
  coords: Coordinates;
}

export interface EventsProvider {
  getUpcomingEvents(coords: Coordinates, radiusMeters?: number): Promise<LocalEvent[]>;
}

export interface MapsProvider {
  calculateDistanceMeters(start: Coordinates, end: Coordinates): number;
  reverseGeocode(coords: Coordinates): Promise<{ city: string; neighborhood?: string; country: string }>;
}

export interface AIProvider {
  generatePersonalizedQuest(context: {
    userId: string;
    preferences: any;
    weather?: WeatherData;
    nearbyPlaces?: Place[];
    availableTime: string;
    energy: string;
    social: string;
  }): Promise<Partial<Quest>>;

  validateSafety(questContent: string): Promise<{ safe: boolean; reasoning?: string }>;
}
