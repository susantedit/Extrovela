/**
 * EXTROVELA — Map Viewport & Marker Clustering Engine (Phase 8)
 * 
 * Supports viewport bounding-box queries and clustering for 100 to 10,000+ points
 * so the client never loads or renders all global records simultaneously.
 */

import { Coordinates } from '../../types/place';
import { MapMarker } from '../context/mapService';

export interface ViewportBoundingBox {
  northEast: Coordinates;
  southWest: Coordinates;
}

export class MapViewportService {
  static filterMarkersInViewport(markers: MapMarker[], viewport: ViewportBoundingBox): MapMarker[] {
    return markers.filter(m => {
      const lat = m.coordinates.lat;
      const lng = m.coordinates.lng;

      return (
        lat <= viewport.northEast.lat &&
        lat >= viewport.southWest.lat &&
        lng <= viewport.northEast.lng &&
        lng >= viewport.southWest.lng
      );
    });
  }

  static clusterMarkers(markers: MapMarker[], zoomLevel = 14): Array<MapMarker | { id: string; type: 'cluster'; count: number; coordinates: Coordinates }> {
    if (zoomLevel >= 15) {
      // High zoom: render individual markers
      return markers;
    }

    // Medium/Low zoom: cluster markers within ~1km
    const clusters: Array<{ id: string; type: 'cluster'; count: number; coordinates: Coordinates }> = [];
    const threshold = zoomLevel <= 11 ? 0.05 : 0.02;

    const used = new Set<string>();

    markers.forEach(m => {
      if (used.has(m.id)) return;

      const nearby = markers.filter(other => {
        if (used.has(other.id)) return false;
        const dLat = Math.abs(m.coordinates.lat - other.coordinates.lat);
        const dLng = Math.abs(m.coordinates.lng - other.coordinates.lng);
        return dLat < threshold && dLng < threshold;
      });

      if (nearby.length > 1) {
        nearby.forEach(n => used.add(n.id));
        clusters.push({
          id: `cluster_${m.id}`,
          type: 'cluster',
          count: nearby.length,
          coordinates: m.coordinates,
        });
      }
    });

    const unclustered = markers.filter(m => !used.has(m.id));
    return [...clusters, ...unclustered];
  }
}
