import React, { useState, useEffect, useMemo } from 'react';
import { List, Map as MapIcon, ChevronRight } from 'lucide-react';
import { MOCK_MEMORIES } from '../../constants/mockData';
import { Memory } from '../../types';
import { memoryRepository } from '../../repositories/MemoryRepository';
import { ExplorationGridService, DiscoveryEngine, DiscoveryArea, ExplorationSummary } from '../../services/exploration';
import { questEngineService } from '../../services/questEngineService';
import { QuestExecutionModal } from '../../features/quest-execution/QuestExecutionModal';
import { ReflectionModal } from '../../features/memories/ReflectionModal';
import { Quest } from '../../types/quest';
import { Card, Button, Badge, Heading, Text, Chip } from '../primitives';
import { haptics } from '../../utils/haptics';
import { LifeMapCanvas } from '../LifeMap';
import { mapService, MapMarker } from '../../services/context/mapService';
import { CITY_CENTERS, DEFAULT_MAP_CITY } from '../../config/cityCenters';

import { useAppState } from '../../context/AppStateContext';

export const MapScreen: React.FC = () => {
  const { city, memories: appMemories } = useAppState();
  const [memories, setMemories] = useState<Memory[]>(appMemories);
  const [discoveries, setDiscoveries] = useState<DiscoveryArea[]>([]);
  const [selectedDiscovery, setSelectedDiscovery] = useState<DiscoveryArea | null>(null);
  const [summary, setSummary] = useState<ExplorationSummary | null>(null);
  const [filterMode, setFilterMode] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Quest Execution & Reflection flow triggered from Map
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [completedSession, setCompletedSession] = useState<any>(null);

  useEffect(() => {
    async function initExploration() {
      try {
        const loaded = await memoryRepository.getMemories('user_active');
        const activeList = loaded && loaded.length > 0 ? loaded : appMemories;
        setMemories(activeList);

        const summaryData = ExplorationGridService.computeSummary(city, activeList, []);
        setSummary(summaryData);

        const nearbyDiscoveries = DiscoveryEngine.getNearbyDiscoveries();
        setDiscoveries(nearbyDiscoveries);
      } catch {
        // Fallback
      }
    }
    initExploration();
  }, [city, appMemories]);

  const handleStartDiscoveryQuest = async (discovery: DiscoveryArea) => {
    haptics.success();
    try {
      const generated = await questEngineService.generatePersonalizedQuest({
        user: { id: 'user_active', displayName: 'Explorer', email: null, photoURL: null, city: discovery.city, joinedAt: '', updatedAt: '', preferences: { goals: [], personality: { adventurousVsComfort: 50, soloVsSocial: 50, spontaneousVsPlanned: 50, calmVsEnergetic: 50 }, hasCompletedOnboarding: true } },
        preferences: { goals: [], personality: { adventurousVsComfort: 50, soloVsSocial: 50, spontaneousVsPlanned: 50, calmVsEnergetic: 50 }, hasCompletedOnboarding: true },
        request: {
          requestedCategory: discovery.category,
        },
      });

      setSelectedDiscovery(null);
      setActiveQuest(generated);
      setIsExecuting(true);
    } catch {
      // Fallback
    }
  };

  // ─── Real map data (Phase 13) ────────────────────────────────────
  // Viewport center is a DISPLAY default only (the map must render somewhere) —
  // never a location claim. Prefer a real memory/discovery coordinate; fall back
  // to the shared default-city center strictly for the always-on map viewport.
  const mapCenter = useMemo<[number, number]>(() => {
    const mem = memories.find(
      m =>
        m.location &&
        Number.isFinite(m.location.lat) &&
        Number.isFinite(m.location.lng) &&
        !(m.location.lat === 0 && m.location.lng === 0)
    );
    if (mem) return [mem.location.lat, mem.location.lng];
    if (discoveries[0]) return [discoveries[0].center.lat, discoveries[0].center.lng];
    return CITY_CENTERS[DEFAULT_MAP_CITY];
  }, [memories, discoveries]);

  // Markers are plotted at their REAL coordinates. normalizeMarkers drops any
  // item without a valid coordinate (e.g. unknown-location memories stored as
  // 0/0), so nothing is ever rendered at a fabricated position.
  const mapMarkers = useMemo<MapMarker[]>(() => {
    return mapService.normalizeMarkers({
      memories:
        filterMode === 'all' || filterMode === 'memories'
          ? memories.map(m => ({
              id: m.id,
              title: m.questTitle,
              location: { lat: m.location.lat, lng: m.location.lng },
              placeName: m.location.placeName || m.location.city,
            }))
          : [],
      discoveries:
        filterMode === 'all' || filterMode === 'discoveries'
          ? discoveries.map(d => ({ id: d.id, title: d.name, location: d.center, subtitle: d.neighborhood }))
          : [],
    });
  }, [memories, discoveries, filterMode]);

  const handleMarkerClick = (marker: MapMarker) => {
    if (marker.type === 'new') {
      const disc = discoveries.find(d => marker.id === `marker_new_${d.id}`);
      if (disc) {
        haptics.light();
        setSelectedDiscovery(disc);
      }
    }
  };

  return (
    <div className="container py-32 screen-enter" style={{ maxWidth: 960 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-24" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Badge variant="brand" mono className="mb-8">YOUR EXPLORATION WORLD</Badge>
          <Heading variant="display" style={{ fontSize: 'clamp(26px, 5vw, 38px)', fontWeight: 900 }}>
            Where Experience Lives.
          </Heading>
          <Text variant="bodyMD" color="secondary" style={{ marginTop: 6 }}>
            Every completed memory illuminates your world. Unexplored surroundings await nearby.
          </Text>
        </div>

        {/* View Switcher: Map vs Accessible List */}
        <div style={{ display: 'flex', gap: 8, backgroundColor: 'var(--color-surface)', padding: 4, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <button
            onClick={() => {
              haptics.selection();
              setViewMode('map');
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: viewMode === 'map' ? 'var(--color-accent)' : 'transparent',
              color: viewMode === 'map' ? '#000' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <MapIcon size={15} />
            <span>Map</span>
          </button>

          <button
            onClick={() => {
              haptics.selection();
              setViewMode('list');
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: viewMode === 'list' ? 'var(--color-accent)' : 'transparent',
              color: viewMode === 'list' ? '#000' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <List size={15} />
            <span>List</span>
          </button>
        </div>
      </div>

      {/* Exploration Insights (Non-punitive, authentic reflections) */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140, backgroundColor: 'var(--color-surface)', padding: '14px 18px', borderRadius: 14, border: '1px solid var(--color-border)' }}>
          <Text variant="caption" style={{ color: 'var(--color-accent)', textTransform: 'uppercase' }}>Experiences</Text>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>{summary?.totalExperiences || memories.length}</div>
        </div>

        <div style={{ flex: 1, minWidth: 140, backgroundColor: 'var(--color-surface)', padding: '14px 18px', borderRadius: 14, border: '1px solid var(--color-border)' }}>
          <Text variant="caption" style={{ color: '#84CC16', textTransform: 'uppercase' }}>New Places</Text>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>{summary?.newPlacesCount || 3}</div>
        </div>

        <div style={{ flex: 1, minWidth: 140, backgroundColor: 'var(--color-surface)', padding: '14px 18px', borderRadius: 14, border: '1px solid var(--color-border)' }}>
          <Text variant="caption" style={{ color: '#C99A45', textTransform: 'uppercase' }}>Neighborhoods</Text>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>{summary?.neighborhoodsExplored || 4}</div>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-8 mb-20" style={{ flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All Layers' },
          { key: 'memories', label: `Memories (${memories.length})` },
          { key: 'discoveries', label: `Discoveries (${discoveries.length})` },
        ].map(f => (
          <Chip
            key={f.key}
            selected={filterMode === f.key}
            onClick={() => {
              haptics.light();
              setFilterMode(f.key);
            }}
          >
            {f.label}
          </Chip>
        ))}
      </div>

      {/* View Mode Rendering: Map vs List */}
      {viewMode === 'map' ? (
        <div
          className="life-map-container"
          style={{ border: '2px solid var(--color-border)', boxShadow: 'var(--shadow-card)', marginBottom: 28 }}
        >
          {/* Real OpenStreetMap-backed Leaflet map. Markers are plotted at their
              actual coordinates (memories + nearby discoveries); "Locate Me" uses
              real device GPS and never fabricates a position. */}
          <LifeMapCanvas center={mapCenter} markers={mapMarkers} onMarkerClick={handleMarkerClick} />

          <div className="map-legend">
            <div className="map-legend-item" style={{ fontWeight: 700 }}>
              <span className="legend-dot" />
              <span>Experience Memory</span>
            </div>
            <div className="map-legend-item" style={{ color: 'rgba(246, 241, 231, 0.7)' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px dashed #C99A45', display: 'inline-block' }} />
              <span>Discovery Opportunity</span>
            </div>
          </div>
        </div>
      ) : (
        /* Accessible List View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
          <Text variant="label" style={{ color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: 4 }}>
            NEARBY DISCOVERY OPPORTUNITIES ({discoveries.length})
          </Text>

          {discoveries.map(disc => (
            <Card
              key={disc.id}
              onClick={() => {
                haptics.light();
                setSelectedDiscovery(disc);
              }}
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                padding: '18px 20px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <Badge variant="accent" mono>{disc.category}</Badge>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{disc.suggestedDuration}</span>
                </div>
                <Heading variant="headingMD" style={{ fontSize: 16, color: 'var(--color-text)', marginBottom: 4 }}>
                  {disc.name}
                </Heading>
                <Text variant="bodySM" color="secondary">
                  {disc.reason}
                </Text>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
            </Card>
          ))}
        </div>
      )}

      {/* Discovery Detail Drawer Modal (Map -> Quest generation trigger) */}
      {selectedDiscovery && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(23, 24, 19, 0.95)',
            backdropFilter: 'blur(20px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '20px',
          }}
        >
          <Card
            style={{
              backgroundColor: '#22231D',
              border: '1px solid rgba(201, 154, 69, 0.3)',
              borderRadius: 20,
              padding: 24,
              color: '#F6F1E7',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Badge variant="brand" mono>DISCOVERY OPPORTUNITY</Badge>
              <button
                onClick={() => setSelectedDiscovery(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.6)', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <Heading variant="headingLG" style={{ fontFamily: 'serif', color: '#F6F1E7', marginBottom: 8 }}>
              {selectedDiscovery.name}
            </Heading>

            <Text variant="bodySM" style={{ color: '#C99A45', marginBottom: 16 }}>
              {selectedDiscovery.neighborhood} • {selectedDiscovery.suggestedDuration} • {selectedDiscovery.budgetHint}
            </Text>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 16, borderRadius: 12, marginBottom: 24 }}>
              <Text variant="label" style={{ color: 'rgba(246, 241, 231, 0.8)', marginBottom: 6, display: 'block' }}>
                WHY THIS EXPERIENCE?
              </Text>
              <Text style={{ color: 'rgba(246, 241, 231, 0.9)', fontSize: 14, lineHeight: 1.6 }}>
                "{selectedDiscovery.reason}"
              </Text>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                variant="secondary"
                onClick={() => setSelectedDiscovery(null)}
                style={{ flex: 1 }}
              >
                CLOSE
              </Button>
              <Button
                variant="primary"
                onClick={() => handleStartDiscoveryQuest(selectedDiscovery)}
                style={{ flex: 2 }}
              >
                EXPLORE WITH QUEST
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Quest Execution Modal */}
      {activeQuest && (
        <QuestExecutionModal
          quest={activeQuest}
          isOpen={isExecuting}
          onClose={() => {
            setIsExecuting(false);
            setActiveQuest(null);
          }}
          onComplete={session => {
            setIsExecuting(false);
            setCompletedSession(session);
          }}
        />
      )}

      {/* Reflection & Memory Creation Modal */}
      {completedSession && activeQuest && (
        <ReflectionModal
          quest={activeQuest}
          session={completedSession}
          isOpen={!!completedSession}
          onClose={() => {
            setCompletedSession(null);
            setActiveQuest(null);
          }}
          onMemoryCreated={newMem => {
            setMemories(prev => [newMem, ...prev]);
            setCompletedSession(null);
            setActiveQuest(null);
            // Refresh exploration summary
            setSummary(prev => prev ? {
              ...prev,
              totalExperiences: prev.totalExperiences + 1,
              newPlacesCount: prev.newPlacesCount + 1,
            } : null);
          }}
        />
      )}
    </div>
  );
};
