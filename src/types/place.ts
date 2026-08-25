/**
 * EXTROVELA — Place & Exploration Domain Contracts
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Place {
  id: string;
  name: string;
  city: string;
  neighborhood?: string;
  coordinates: Coordinates;
  category: string;
  isIndoor: boolean;
  priceLevel?: string;
  rating?: number;
  userVisitCount?: number;
  weatherSuitability?: string[];
  tags: string[];
  /**
   * Raw provider opening-hours string (e.g. OSM `opening_hours`), when the source
   * supplies one. Interpreted best-effort by placesService.evaluateOpeningHours;
   * absence means "unknown", never "open".
   */
  openingHours?: string;
}

export interface ExplorationRecord {
  id: string;
  userId: string;
  placeId: string;
  placeName: string;
  coordinates: Coordinates;
  visitedAt: string;
  isFirstTimeVisit: boolean;
}
