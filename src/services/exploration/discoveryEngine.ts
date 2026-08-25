/**
 * EXTROVELA — Discovery Engine (Phase 8)
 * 
 * Recommends unexplored places and experiential areas based on user history,
 * variety balancing, travel distance, and weather context.
 */

import { Coordinates } from '../../types/place';
import { DiscoveryArea } from './explorationTypes';
import { GeospatialUtils } from '../context/geospatialUtils';

export class DiscoveryEngine {
  static getNearbyDiscoveries(origin: Coordinates = { lat: 27.7172, lng: 85.3240 }): DiscoveryArea[] {
    const seedDiscoveries: Array<Omit<DiscoveryArea, 'approxDistanceMeters'>> = [
      {
        id: 'disc_patan_courtyards',
        name: 'Hidden Patan Brick Courtyards',
        city: 'Kathmandu',
        neighborhood: 'Patan Heritage Zone',
        category: 'Quiet Sanctuary',
        center: { lat: 27.6744, lng: 85.3245 },
        reason: "You've been logging active urban walks. This area offers secluded, historic stone courtyards for quiet reflection.",
        suggestedDuration: '30 mins',
        budgetHint: 'Free',
        isUnexplored: true,
      },
      {
        id: 'disc_swayambhu_ridge',
        name: 'Swayambhunath Western Ridge',
        city: 'Kathmandu',
        neighborhood: 'Chhauni / Swayambhu',
        category: 'Viewpoint',
        center: { lat: 27.7149, lng: 85.2903 },
        reason: 'Sunset is approaching with clear skies. This viewpoint has a wide western horizon you haven’t logged a memory from.',
        suggestedDuration: '45 mins',
        budgetHint: 'Free',
        isUnexplored: true,
      },
      {
        id: 'disc_boudha_outer_ring',
        name: 'Boudha Outer Monastery Alleys',
        city: 'Kathmandu',
        neighborhood: 'Boudhanath',
        category: 'Culture & Solitude',
        center: { lat: 27.7215, lng: 85.3620 },
        reason: 'Step away from the main stupa circuit into the quiet monastery gardens behind the main ring.',
        suggestedDuration: '40 mins',
        budgetHint: 'Low ($)',
        isUnexplored: true,
      },
    ];

    return seedDiscoveries.map(d => ({
      ...d,
      approxDistanceMeters: GeospatialUtils.calculateDistanceMeters(origin, d.center),
    }));
  }
}
