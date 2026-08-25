/**
 * EXTROVELA — Map Foundation & Marker Architecture (Phase 6)
 * 
 * Provides normalized map markers and viewport filtering for the Life Map.
 */

import { Coordinates } from '../../types/place';

export type MapMarkerType = 'current' | 'memory' | 'explored' | 'quest' | 'place' | 'new';

export interface MapMarker {
  id: string;
  type: MapMarkerType;
  title: string;
  subtitle?: string;
  coordinates: Coordinates;
  isPrivacySafe: boolean;
}

/**
 * A coordinate is only plottable if it is finite, in range, and NOT the (0,0)
 * "null island" sentinel. Memories/records with an unknown location store 0/0
 * (see ReflectionModal); we must never render those as a real pin somewhere in
 * the Gulf of Guinea — that would fabricate a location. Such items are simply
 * omitted from the map (they still appear in list views and stats).
 */
function isPlottableCoord(c?: Coordinates | null): c is Coordinates {
  return (
    !!c &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    Math.abs(c.lat) <= 90 &&
    Math.abs(c.lng) <= 180 &&
    !(c.lat === 0 && c.lng === 0)
  );
}

export class MapService {
  normalizeMarkers(params: {
    currentLocation?: Coordinates;
    memories?: Array<{ id: string; title: string; location: Coordinates; placeName?: string }>;
    questDestination?: { id: string; title: string; location: Coordinates };
    discoveries?: Array<{ id: string; title: string; location: Coordinates; subtitle?: string }>;
  }): MapMarker[] {
    const markers: MapMarker[] = [];
    const add = (marker: MapMarker) => {
      // Single choke point: nothing with an invalid/sentinel coordinate is ever emitted.
      if (isPlottableCoord(marker.coordinates)) markers.push(marker);
    };

    if (params.currentLocation) {
      add({
        id: 'marker_current_user',
        type: 'current',
        title: 'Your Location',
        coordinates: params.currentLocation,
        isPrivacySafe: true,
      });
    }

    if (params.questDestination) {
      add({
        id: `marker_quest_${params.questDestination.id}`,
        type: 'quest',
        title: params.questDestination.title,
        coordinates: params.questDestination.location,
        isPrivacySafe: true,
      });
    }

    (params.memories || []).forEach(m => {
      add({
        id: `marker_mem_${m.id}`,
        type: 'memory',
        title: m.title,
        subtitle: m.placeName,
        coordinates: m.location,
        isPrivacySafe: true,
      });
    });

    // Nearby discovery opportunities (unexplored). Real seed coordinates only —
    // rendered as 'new' pins. Never fabricated; skipped if coords are invalid.
    (params.discoveries || []).forEach(d => {
      add({
        id: `marker_new_${d.id}`,
        type: 'new',
        title: d.title,
        subtitle: d.subtitle,
        coordinates: d.location,
        isPrivacySafe: true,
      });
    });

    return markers;
  }
}

export const mapService = new MapService();
export default mapService;
