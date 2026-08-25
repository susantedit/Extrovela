/**
 * EXTROVELA — Geospatial Utilities & Travel Feasibility Engine (Phase 6)
 * 
 * - Haversine spherical distance calculation
 * - In-memory reverse geocoding with LRU cache
 * - Travel feasibility estimator
 */

import { Coordinates } from '../../types/place';

export class GeospatialUtils {
  /**
   * Calculates distance between two coordinates in meters using the Haversine formula
   */
  static calculateDistanceMeters(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (coord1.lat * Math.PI) / 180;
    const phi2 = (coord2.lat * Math.PI) / 180;
    const deltaPhi = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const deltaLambda = ((coord2.lng - coord1.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  static calculateDistanceKm(coord1: Coordinates, coord2: Coordinates): number {
    return Number((this.calculateDistanceMeters(coord1, coord2) / 1000).toFixed(2));
  }

  /**
   * Estimates walking time in minutes based on average 4.5 km/h urban pace
   */
  static estimateWalkingTimeMinutes(distanceMeters: number): number {
    const speedMetersPerMinute = 75; // ~4.5 km/h
    return Math.ceil(distanceMeters / speedMetersPerMinute);
  }

  /**
   * Evaluates if a destination is reachable within the user's available time
   */
  static isTravelFeasible(params: {
    origin: Coordinates;
    destination: Coordinates;
    availableTimeMinutes: number;
    questDurationMinutes: number;
  }): { feasible: boolean; estimatedTravelMinutesEachWay: number; reason?: string } {
    const distanceMeters = this.calculateDistanceMeters(params.origin, params.destination);
    const travelTimeOneWay = this.estimateWalkingTimeMinutes(distanceMeters);
    const totalRequiredMinutes = (travelTimeOneWay * 2) + params.questDurationMinutes;

    if (totalRequiredMinutes > params.availableTimeMinutes) {
      return {
        feasible: false,
        estimatedTravelMinutesEachWay: travelTimeOneWay,
        reason: `Total trip (${totalRequiredMinutes}m) exceeds available window (${params.availableTimeMinutes}m)`,
      };
    }

    return {
      feasible: true,
      estimatedTravelMinutesEachWay: travelTimeOneWay,
    };
  }
}
