import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Grid, Search, Sparkles, FolderOpen, LucideIcon } from 'lucide-react';
import { MOCK_MEMORIES } from '../../constants/mockData';
import { Memory } from '../../types';
import { memoryRepository } from '../../repositories/MemoryRepository';
import { ExperienceStatsService } from '../../services/memories/experienceStatsService';
import { groupMemoriesByPeriod, TimelineGrouping } from '../../services/memories/timelineGrouping';
import { Card, Badge, Heading, Text, Chip } from '../primitives';
import { CalendarJournalView } from '../../features/memories/CalendarJournalView';
import { MemoryDetailModal } from '../../features/memories/MemoryDetailModal';
import { RecapPanel } from '../../features/memories/RecapPanel';
import { CollectionsPanel } from '../../features/memories/CollectionsPanel';
import { haptics } from '../../utils/haptics';
import { useAuth } from '../../context/AuthContext';
import { experienceIntelligenceService } from '../../services/intelligence/experienceIntelligenceService';
import { shareExperienceCardService } from '../../services/sharing/shareExperienceCardService';
import { analytics } from '../../services/firebase/firebaseAnalytics';

type ViewMode = 'timeline' | 'calendar' | 'recaps' | 'collections';

const VIEW_TABS: { key: ViewMode; label: string; Icon: LucideIcon }[] = [
  { key: 'timeline', label: 'Timeline', Icon: Grid },
  { key: 'calendar', label: 'Calendar', Icon: CalendarIcon },
  { key: 'recaps', label: 'Recaps', Icon: Sparkles },
  { key: 'collections', label: 'Collections', Icon: FolderOpen },
];

const GROUPINGS: { key: TimelineGrouping; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export const MemoriesScreen: React.FC = () => {
  const { user } = useAuth();
  const authUserId = user?.uid ?? null;
  const [memories, setMemories] = useState<Memory[]>(MOCK_MEMORIES as Memory[]);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [grouping, setGrouping] = useState<TimelineGrouping>('month');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [filterTag, setFilterTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadMemories = async () => {
    if (!authUserId) return;
    try {
      const loaded = await memoryRepository.getMemories(authUserId);
      if (loaded && loaded.length > 0) {
        setMemories(loaded);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadMemories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  useEffect(() => {
    analytics.trackEvent('memory_journal_opened', {});
  }, []);

  const stats = ExperienceStatsService.computeStats(memories);

  const handleDeleteMemory = async (memoryId: string) => {
    haptics.medium();
    if (authUserId) {
      await memoryRepository.deleteMemory(authUserId, memoryId);
    }
    setMemories(prev => prev.filter(m => m.id !== memoryId));
    setSelectedMemory(null);
    analytics.trackEvent('memory_deleted', { memory_id: memoryId });

    // Phase 11 — deletion propagation. Purge every derived artefact whose
    // lineage points at this memory and rebuild the profile, so a deleted
    // memory stops influencing personalization. Keyed to the authenticated
    // uid; fire-and-forget so the UI removal never waits on the purge.
    if (authUserId) {
      void experienceIntelligenceService.recordMemoryDeleted(authUserId, memoryId).catch(() => {});

      // Phase 12 — revoke any public share links whose subject is this memory,
      // so a deleted memory can no longer be resolved through a card that was
      // published earlier. Best-effort and off the UI path.
      void (async () => {
        try {
          const tokens = await shareExperienceCardService.listOwn(authUserId);
          await Promise.all(
            tokens
              .filter(t => t.subjectType === 'memory' && t.subjectId === memoryId && !t.revoked)
              .map(t => shareExperienceCardService.revoke(authUserId, t.token))
          );
        } catch {
          /* best-effort */
        }
      })();
    }
  };

  const handleToggleFavorite = async (memoryId: string) => {
    haptics.selection();
    if (!authUserId) return;
    const isFav = await memoryRepository.toggleFavorite(authUserId, memoryId);
    setMemories(prev =>
      prev.map(m => (m.id === memoryId ? { ...m, isFavorite: isFav } : m))
    );
    analytics.trackEvent('memory_favorited', { memory_id: memoryId });
    if (selectedMemory && selectedMemory.id === memoryId) {
      setSelectedMemory(prev => (prev ? { ...prev, isFavorite: isFav } : null));
    }
  };

  const openMemory = (memory: Memory) => {
    haptics.light();
    analytics.trackEvent('memory_detail_opened', { memory_id: memory.id });
    setSelectedMemory(memory);
  };

  const changeView = (mode: ViewMode) => {
    haptics.selection();
    setViewMode(mode);
    if (mode === 'timeline') {
      analytics.trackEvent('timeline_opened', { timeline_grouping: grouping });
    }
  };

  const changeGrouping = (g: TimelineGrouping) => {
    haptics.light();
    setGrouping(g);
    analytics.trackEvent('timeline_period_changed', { timeline_grouping: g });
  };

  const filtered = memories.filter(m => {
    // Search query check
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (m.title || m.questTitle || '').toLowerCase().includes(q);
      const matchReflect = (m.reflectionText || '').toLowerCase().includes(q);
      const matchCity = (m.location?.city || '').toLowerCase().includes(q);
      const matchTags = (m.tags || []).some(t => t.toLowerCase().includes(q));
      if (!matchTitle && !matchReflect && !matchCity && !matchTags) return false;
    }

    // Filter chip check
    if (filterTag === 'all') return true;
    if (filterTag === 'favorites') return m.isFavorite;
    if (filterTag === 'first-time') return m.isFirstTimeExperience;
    if (filterTag === 'photos') return !!(m.photoUrl || (m.photos && m.photos.length > 0));
    return (m.tags || []).includes(filterTag);
  });

  const renderMemoryCard = (memory: Memory) => {
    const displayTitle = memory.title || memory.questTitle;
    const heroImg = memory.photoUrl || (memory.photos && memory.photos.length > 0 ? memory.photos[0].downloadUrl : undefined);
    const stars = memory.rating || memory.moodRating || 5;

    return (
      <Card
        key={memory.id}
        onClick={() => openMemory(memory)}
        style={{
          cursor: 'pointer',
          overflow: 'hidden',
          backgroundColor: 'var(--color-surface)',
          border: memory.isFavorite ? '1px solid #C99A45' : '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 0,
          position: 'relative',
        }}
      >
        {memory.isFavorite && (
          <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 12, color: '#C99A45', fontSize: 11 }}>
            ★ Favorite
          </div>
        )}
        {heroImg ? (
          <div style={{ height: 160, overflow: 'hidden' }}>
            <img src={heroImg} alt={displayTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{ height: 100, backgroundColor: 'rgba(201, 154, 69, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 28 }}>🌿</span>
          </div>
        )}
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-accent)', fontWeight: 600 }}>
              {new Date(memory.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-accent)' }}>{'★'.repeat(stars)}</span>
          </div>
          <Heading variant="headingMD" style={{ fontSize: 16, marginBottom: 6 }}>
            {displayTitle}
          </Heading>
          <Text variant="bodySM" color="secondary" style={{ fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            "{memory.reflectionText}"
          </Text>
        </div>
      </Card>
    );
  };

  const timelineGroups = groupMemoriesByPeriod(filtered, grouping);

  return (
    <div className="container py-32 screen-enter" style={{ maxWidth: 960 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-24" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Badge variant="brand" mono className="mb-8">EXPERIENCE JOURNAL</Badge>
          <Heading variant="display" style={{ fontSize: 'clamp(26px, 5vw, 38px)', fontWeight: 900 }}>
            Memories Made Real.
          </Heading>
          <Text variant="bodyMD" color="secondary" style={{ marginTop: 6 }}>
            Every completed quest transforms into a story in your personal life history.
          </Text>
        </div>

        {/* View Switcher */}
        <div style={{ display: 'flex', gap: 4, backgroundColor: 'var(--color-surface)', padding: 4, borderRadius: 12, border: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          {VIEW_TABS.map(tab => {
            const active = viewMode === tab.key;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.key}
                onClick={() => changeView(tab.key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: active ? 'var(--color-accent)' : 'transparent',
                  color: active ? '#000' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Experience Stats Summary Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 24,
          backgroundColor: 'rgba(32, 33, 27, 0.6)',
          border: '1px solid var(--color-border)',
          borderRadius: 14,
          padding: '16px 20px',
        }}
      >
        <div>
          <Text variant="caption" style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>TOTAL STORIES</Text>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'serif' }}>
            {stats.totalExperiences}
          </div>
        </div>
        <div>
          <Text variant="caption" style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>NEW PLACES</Text>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#84CC16', fontFamily: 'serif' }}>
            {stats.newPlacesCount}
          </div>
        </div>
        <div>
          <Text variant="caption" style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>FIRST-TIMES</Text>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#3B82F6', fontFamily: 'serif' }}>
            {stats.firstTimeCount}
          </div>
        </div>
        <div>
          <Text variant="caption" style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>FAVORITES</Text>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#F59E0B', fontFamily: 'serif' }}>
            {stats.favoriteExperiences}
          </div>
        </div>
      </div>

      {/* Search + filter + grouping — Timeline only */}
      {viewMode === 'timeline' && (
        <div style={{ marginBottom: 24 }}>
          {/* Search Box */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-secondary)' }} />
            <input
              type="text"
              placeholder="Search memories by title, reflection, city, tag..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                padding: '10px 12px 10px 38px',
                color: 'var(--color-text)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Filter Chips */}
          <div className="flex gap-8" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { key: 'all', label: `All (${memories.length})` },
              { key: 'favorites', label: '★ Favorites' },
              { key: 'first-time', label: '✨ First-Times' },
              { key: 'photos', label: '📷 Photos' },
              { key: 'sunset', label: 'Sunsets' },
              { key: 'teahouse', label: 'Sanctuaries' },
            ].map(f => (
              <Chip
                key={f.key}
                selected={filterTag === f.key}
                onClick={() => {
                  haptics.light();
                  setFilterTag(f.key);
                  analytics.trackEvent('memory_filtered', { filter_kind: f.key });
                }}
              >
                {f.label}
              </Chip>
            ))}
          </div>

          {/* Grouping selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text variant="caption" style={{ color: 'var(--color-text-secondary)' }}>Group by</Text>
            {GROUPINGS.map(g => (
              <button
                key={g.key}
                onClick={() => changeGrouping(g.key)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 8,
                  border: grouping === g.key ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                  backgroundColor: grouping === g.key ? 'rgba(132,204,22,0.12)' : 'transparent',
                  color: grouping === g.key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {viewMode === 'calendar' ? (
        <CalendarJournalView memories={memories} onSelectMemory={openMemory} />
      ) : viewMode === 'recaps' ? (
        <RecapPanel memories={memories} userId={authUserId} />
      ) : viewMode === 'collections' ? (
        <CollectionsPanel memories={memories} userId={authUserId} onSelectMemory={openMemory} />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', backgroundColor: 'var(--color-surface)', borderRadius: 16, border: '1px dashed var(--color-border)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📖</div>
          <Heading variant="headingMD" style={{ marginBottom: 8 }}>
            Your first story is waiting.
          </Heading>
          <Text variant="bodySM" color="secondary">
            Nothing matching this filter yet. Go out and make today different.
          </Text>
        </div>
      ) : (
        <div className="mb-36">
          {timelineGroups.map(group => (
            <div key={group.key} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
                <Heading variant="headingMD" style={{ fontSize: 16 }}>{group.label}</Heading>
                <Text variant="caption" color="secondary">
                  {group.memories.length} {group.memories.length === 1 ? 'memory' : 'memories'}
                </Text>
              </div>
              <div className="grid-3">
                {group.memories.map(renderMemoryCard)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Memory Detail Modal */}
      <MemoryDetailModal
        memory={selectedMemory}
        isOpen={!!selectedMemory}
        onClose={() => setSelectedMemory(null)}
        onDeleteMemory={handleDeleteMemory}
        onToggleFavorite={handleToggleFavorite}
        userId={authUserId}
      />
    </div>
  );
};

export default MemoriesScreen;
