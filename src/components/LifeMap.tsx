import React, { useEffect, useRef, useState } from 'react';
import { Compass, Lock, Navigation } from 'lucide-react';
import L from 'leaflet';
// Leaflet's own stylesheet — WITHOUT this the tiles/controls render unstyled and
// the map is effectively invisible. Imported once here; bundled by Vite.
import 'leaflet/dist/leaflet.css';
import { useAppState } from '../context/AppStateContext';
import { getCurrentGPS, triggerHaptic } from '../lib/native-device';
import { mapService, MapMarker, MapMarkerType } from '../services/context/mapService';
import { CITY_CENTERS, DEFAULT_MAP_CITY } from '../config/cityCenters';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; EXTROVELA';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Per-type marker visuals. Uses divIcon (inline HTML) to avoid Leaflet's default
 *  marker PNG, which 404s under Vite's asset pipeline without extra config. */
function divIconFor(type: MapMarkerType): L.DivIcon {
  const styles: Record<MapMarkerType, { size: number; html: string }> = {
    memory: {
      size: 30,
      html: `<div style="width:30px;height:30px;background:linear-gradient(135deg,#84CC16,#F59E0B);border:2px solid #fff;border-radius:50%;box-shadow:0 0 16px rgba(132,204,22,0.8);display:flex;align-items:center;justify-content:center;font-size:13px;">✨</div>`,
    },
    new: {
      size: 32,
      html: `<div style="width:32px;height:32px;background:#22231D;border:2px dashed #C99A45;border-radius:50%;box-shadow:0 0 14px rgba(201,154,69,0.5);display:flex;align-items:center;justify-content:center;color:#C99A45;font-size:15px;">◈</div>`,
    },
    current: {
      size: 20,
      html: `<div style="width:20px;height:20px;background:#06B6D4;border:3px solid #fff;border-radius:50%;box-shadow:0 0 16px #06B6D4;"></div>`,
    },
    quest: {
      size: 30,
      html: `<div style="width:30px;height:30px;background:#0E7490;border:2px solid #67E8F9;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 0 14px rgba(6,182,212,0.6);"></div>`,
    },
    place: {
      size: 26,
      html: `<div style="width:26px;height:26px;background:#22231D;border:2px solid #C99A45;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#C99A45;font-size:12px;">•</div>`,
    },
    explored: {
      size: 26,
      html: `<div style="width:26px;height:26px;background:#1D2A20;border:2px solid #84CC16;border-radius:50%;"></div>`,
    },
  };
  const spec = styles[type] || styles.place;
  return L.divIcon({
    className: '',
    html: spec.html,
    iconSize: [spec.size, spec.size],
    iconAnchor: [spec.size / 2, spec.size / 2],
  });
}

export interface LifeMapCanvasProps {
  /** Initial viewport center. Display default only — never a data claim. */
  center: [number, number];
  zoom?: number;
  /** Pre-normalized, privacy-safe markers (see MapService.normalizeMarkers). */
  markers: MapMarker[];
  onMarkerClick?: (marker: MapMarker) => void;
  /** Fired after a successful GPS locate (for parent-side haptics/analytics). */
  onLocate?: (coords: { lat: number; lng: number }) => void;
  showLocateButton?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Reusable Leaflet map surface. Initializes the map once per center/zoom change,
 * syncs markers into a dedicated layer group, and offers an optional GPS "Locate
 * Me" control. Never fabricates a location — a failed GPS fix simply does nothing.
 */
export const LifeMapCanvas: React.FC<LifeMapCanvasProps> = ({
  center,
  zoom = 13,
  markers,
  onMarkerClick,
  onLocate,
  showLocateButton = true,
  className,
  style,
}) => {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Initialize (and re-initialize on center/zoom change). Keeps the original
  // remove()/re-init cleanup so we never leak a Leaflet instance.
  useEffect(() => {
    if (!mapElRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapElRef.current, { center, zoom, zoomControl: false });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      userLayerRef.current = null;
    };
    // center is an array; depend on its scalar parts to avoid identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);

  // Sync markers whenever they change (without tearing down the map/viewport).
  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    markers.forEach(m => {
      const marker = L.marker([m.coordinates.lat, m.coordinates.lng], { icon: divIconFor(m.type) });
      const subtitle = m.subtitle ? `<p style="color:#8B8FA3;font-size:11px;margin:4px 0 0;">${escapeHtml(m.subtitle)}</p>` : '';
      marker.bindPopup(
        `<div style="font-family:sans-serif;padding:2px;max-width:200px;">
           <strong style="color:#84CC16;display:block;font-size:13px;">${escapeHtml(m.title)}</strong>
           ${subtitle}
         </div>`
      );
      if (onMarkerClick) marker.on('click', () => onMarkerClick(m));
      marker.addTo(layer);
    });
  }, [markers, onMarkerClick]);

  const handleLocate = async () => {
    setIsLocating(true);
    triggerHaptic('light');
    const gps = await getCurrentGPS();
    const map = mapRef.current;
    const userLayer = userLayerRef.current;

    if (gps && map && userLayer) {
      triggerHaptic('success');
      userLayer.clearLayers();
      L.marker([gps.lat, gps.lng], { icon: divIconFor('current') })
        .bindPopup('<strong style="color:#06B6D4">You are here</strong>')
        .addTo(userLayer)
        .openPopup();
      map.flyTo([gps.lat, gps.lng], 15, { duration: 1.5 });
      onLocate?.({ lat: gps.lat, lng: gps.lng });
    } else {
      // No fix / permission denied — do NOT invent a location.
      triggerHaptic('warning');
    }
    setIsLocating(false);
  };

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <div ref={mapElRef} style={{ width: '100%', height: '100%', zIndex: 0 }} />
      {showLocateButton && (
        <button
          className="btn btn-glass"
          onClick={handleLocate}
          style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 10, fontSize: 12, padding: '10px 14px' }}
        >
          <Navigation style={{ width: 14, height: 14, color: 'var(--color-accent)' }} />
          <span>{isLocating ? 'Locating…' : 'Locate Me'}</span>
        </button>
      )}
    </div>
  );
};

export const LifeMap: React.FC = () => {
  const { city, memories, stats } = useAppState();

  const center = CITY_CENTERS[city] || CITY_CENTERS[DEFAULT_MAP_CITY];
  const markers = mapService.normalizeMarkers({
    memories: memories.map(m => ({
      id: m.id,
      title: m.questTitle,
      location: { lat: m.location.lat, lng: m.location.lng },
      placeName: m.location.placeName || m.location.city,
    })),
  });

  return (
    <div className="container py-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-24" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="pill pill-brand mb-8">
            <Compass style={{ width: 13, height: 13 }} />
            <span>Open-World Fog of War</span>
          </div>
          <h2 className="font-display" style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800 }}>
            Exploration Map of <span className="text-gradient-brand">{city}</span>
          </h2>
          <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
            Complete quests to reveal your real-world map.
          </p>
        </div>

        <div className="explore-stat">
          <div className="explore-stat-ring">
            <div className="explore-stat-ring-inner">{stats.cityExplorationPercent}%</div>
          </div>
          <div>
            <h4 className="form-label" style={{ marginBottom: 2 }}>City Unlocked</h4>
            <p className="text-sm font-bold">{memories.length} Memory Pins</p>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="glass-card life-map-container">
        <LifeMapCanvas center={center} markers={markers} />
        <div className="map-legend">
          <div className="map-legend-item font-bold">
            <span className="legend-dot" />
            <span>Revealed Experience Pin</span>
          </div>
          <div className="map-legend-item text-muted">
            <Lock style={{ width: 13, height: 13 }} />
            <span>Unexplored Territory</span>
          </div>
        </div>
      </div>
    </div>
  );
};
