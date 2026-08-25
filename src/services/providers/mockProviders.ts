/**
 * EXTROVELA — Mock Fallback Providers (Phase 4)
 */

import {
  WeatherProvider,
  WeatherData,
  PlacesProvider,
  MapsProvider,
  AIProvider,
} from './interfaces';
import { Coordinates, Place } from '../../types/place';
import { Quest } from '../../types/quest';

export class MockWeatherProvider implements WeatherProvider {
  async getWeatherAtCoordinates(_coords: Coordinates): Promise<WeatherData> {
    return {
      temperatureCelsius: 22,
      condition: 'clear',
      precipitationProbability: 10,
      sunsetTime: '18:45',
      isGoldenHour: true,
    };
  }

  async getSunsetTime(_city: string): Promise<string> {
    return '18:45';
  }
}

export class MockPlacesProvider implements PlacesProvider {
  async searchNearbyPlaces(_coords: Coordinates): Promise<Place[]> {
    return [
      {
        id: 'place_patan_alley',
        name: 'Patan Courtyard Teahouse',
        category: 'Quiet Sanctuary',
        city: 'Kathmandu',
        coordinates: { lat: 27.6744, lng: 85.3245 },
        isIndoor: true,
        rating: 4.8,
        priceLevel: '$',
        tags: ['quiet', 'teahouse', 'patan'],
      },
    ];
  }

  async getPlaceDetails(placeId: string): Promise<Place | null> {
    return {
      id: placeId,
      name: 'Swayambhunath Hilltop Ridge',
      category: 'Viewpoint',
      city: 'Kathmandu',
      coordinates: { lat: 27.7149, lng: 85.2903 },
      isIndoor: false,
      rating: 4.9,
      tags: ['sunset', 'ridge', 'viewpoint'],
    };
  }
}

export class MockMapsProvider implements MapsProvider {
  calculateDistanceMeters(start: Coordinates, end: Coordinates): number {
    const R = 6371e3;
    const phi1 = (start.lat * Math.PI) / 180;
    const phi2 = (end.lat * Math.PI) / 180;
    const deltaPhi = ((end.lat - start.lat) * Math.PI) / 180;
    const deltaLambda = ((end.lng - start.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  async reverseGeocode(_coords: Coordinates): Promise<{ city: string; neighborhood?: string; country: string }> {
    return {
      city: 'Kathmandu',
      neighborhood: 'Patan Heritage Zone',
      country: 'Nepal',
    };
  }
}

export class MockAIProvider implements AIProvider {
  async generatePersonalizedQuest(_context: any): Promise<Partial<Quest>> {
    return {
      title: 'The Hidden Rooftop Perspective',
      description: 'Climb to the highest accessible terrace in your neighborhood. Look at the horizon without taking any phone photos for 15 minutes.',
      category: 'Mindfulness & Viewpoints',
      time: '30 mins',
      budget: 'Free',
      social: 'Solo',
      whyThisQuest: 'Matches your current outdoor exploration style and calm energy.',
    };
  }

  async validateSafety(_questContent: string): Promise<{ safe: boolean; reasoning?: string }> {
    return { safe: true };
  }
}

export const mockWeather = new MockWeatherProvider();
export const mockPlaces = new MockPlacesProvider();
export const mockMaps = new MockMapsProvider();
export const mockAI = new MockAIProvider();
