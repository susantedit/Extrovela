/**
 * EXTROVELA — Collections Panel (Phase 12)
 *
 * Mounts the REAL smart-collection engine into the Memories tab. Smart membership
 * is computed on-device by the pure evaluateSmartCollection — there is no LLM and
 * no opaque scoring, so a collection can honestly say "these are here because they
 * are outdoor experiences". Manual collections are the user's hand-picked sets,
 * persisted to the owner-only Firestore subcollection. Nothing here fabricates a
 * membership: a memory is in a collection iff it matches the rule (smart) or the
 * user added it (manual).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Memory } from '../../types/memory';
import { MemoryCollection } from '../../types/collections';
import {
  PREDEFINED_SMART_COLLECTIONS,
  evaluateSmartCollection,
} from '../../services/memories/smartCollectionRules';
import { firestoreService } from '../../services/firebase/firestore';
import { analytics } from '../../services/firebase/firebaseAnalytics';
import { Heading, Text } from '../../components/primitives/Typography';
import { Button } from '../../components/primitives/Button';
import { haptics } from '../../utils/haptics';

interface CollectionsPanelProps {
  memories: Memory[];
  userId: string | null;
  onSelectMemory: (memory: Memory) => void;
}

interface ResolvedCollection {
  id: string;
  name: string;
  icon: string;
  isSmart: boolean;
  memoryIds: string[];
  persisted: boolean; // false for the built-in defaults
}

function makeCollectionId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `coll_${Date.now().toString(36)}_${rand}`;
}

export const CollectionsPanel: React.FC<CollectionsPanelProps> = ({ memories, userId, onSelectMemory }) => {
  const [saved, setSaved] = useState<MemoryCollection[]>([]);
  const [selected, setSelected] = useState<ResolvedCollection | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    firestoreService
      .getMemoryCollections(userId)
      .then(list => {
        if (!cancelled) setSaved(list || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Built-in smart collections with LIVE counts, plus the user's saved ones.
  const resolved: ResolvedCollection[] = useMemo(() => {
    const defaults = PREDEFINED_SMART_COLLECTIONS.map(def => ({
      id: `smart_${def.key}`,
      name: def.name,
      icon: def.icon,
      isSmart: true,
      memoryIds: evaluateSmartCollection(def.rule, memories),
      persisted: false,
    }));

    const persisted = saved.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon || (c.isSmart ? '✨' : '📁'),
      isSmart: c.isSmart,
      memoryIds: c.isSmart && c.rule ? evaluateSmartCollection(c.rule, memories) : c.memoryIds.filter(id => memories.some(m => m.id === id)),
      persisted: true,
    }));

    return [...persisted, ...defaults];
  }, [memories, saved]);

  const selectedMemories = useMemo(() => {
    if (!selected) return [];
    const idSet = new Set(selected.memoryIds);
    return memories.filter(m => idSet.has(m.id));
  }, [selected, memories]);

  const openCollection = (coll: ResolvedCollection) => {
    haptics.light();
    if (coll.isSmart) {
      analytics.trackEvent('smart_collection_viewed', { collection_size: coll.memoryIds.length });
    }
    setSelected(coll);
  };

  const createManualFromFavorites = async () => {
    const name = newName.trim();
    if (!name || !userId) return;
    haptics.medium();
    const favIds = memories.filter(m => m.isFavorite).map(m => m.id);
    const nowIso = new Date().toISOString();
    const coll: MemoryCollection = {
      id: makeCollectionId(),
      userId,
      name: name.slice(0, 80),
      isSmart: false,
      icon: '📁',
      memoryIds: favIds,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await firestoreService.saveMemoryCollection(userId, coll).catch(() => {});
    analytics.trackEvent('collection_created', { collection_size: favIds.length });
    if (favIds.length > 0) analytics.trackEvent('collection_memory_added', { collection_size: favIds.length });
    setSaved(prev => [coll, ...prev]);
    setNewName('');
    setCreating(false);
  };

  const deleteCollection = async (coll: ResolvedCollection) => {
    if (!userId || !coll.persisted) return;
    haptics.medium();
    await firestoreService.deleteMemoryCollection(userId, coll.id).catch(() => {});
    setSaved(prev => prev.filter(c => c.id !== coll.id));
    if (selected?.id === coll.id) setSelected(null);
  };

  // ── Member view ──
  if (selected) {
    return (
      <div style={{ marginBottom: 36 }}>
        <button
          onClick={() => setSelected(null)}
          style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: 14, marginBottom: 16, padding: 0 }}
        >
          ← All collections
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 26 }}>{selected.icon}</span>
          <Heading variant="headingLG">{selected.name}</Heading>
        </div>
        <Text variant="bodySM" color="secondary" style={{ display: 'block', marginBottom: 20 }}>
          {selected.isSmart ? 'Smart collection · membership computed on-device' : 'Hand-picked collection'} · {selectedMemories.length}{' '}
          {selectedMemories.length === 1 ? 'memory' : 'memories'}
        </Text>

        {selectedMemories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: 'var(--color-surface)', borderRadius: 16, border: '1px dashed var(--color-border)' }}>
            <Text variant="bodySM" color="secondary">No memories match this collection yet.</Text>
          </div>
        ) : (
          <div className="grid-3">
            {selectedMemories.map(memory => {
              const heroImg = memory.photoUrl || (memory.photos && memory.photos.length > 0 ? memory.photos[0].downloadUrl : undefined);
              return (
                <div
                  key={memory.id}
                  onClick={() => {
                    haptics.light();
                    onSelectMemory(memory);
                  }}
                  style={{
                    cursor: 'pointer',
                    overflow: 'hidden',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  {heroImg ? (
                    <div style={{ height: 120, overflow: 'hidden' }}>
                      <img src={heroImg} alt={memory.title || memory.questTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ height: 80, backgroundColor: 'rgba(201, 154, 69, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 24 }}>🌿</span>
                    </div>
                  )}
                  <div style={{ padding: 12 }}>
                    <Heading variant="headingMD" style={{ fontSize: 14 }}>
                      {memory.title || memory.questTitle}
                    </Heading>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Collection grid ──
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <Text variant="bodySM" color="secondary">
          Smart collections update themselves as you make new memories.
        </Text>
        <Button variant="secondary" onClick={() => setCreating(v => !v)} style={{ fontSize: 13 }}>
          + New Collection
        </Button>
      </div>

      {creating && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newName}
            maxLength={80}
            placeholder="Collection name (seeded from your favorites)"
            onChange={e => setNewName(e.target.value)}
            style={{
              flex: 1,
              minWidth: 200,
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              padding: '10px 12px',
              color: 'var(--color-text)',
              fontSize: 14,
            }}
          />
          <Button variant="primary" onClick={createManualFromFavorites} disabled={!newName.trim() || !userId}>
            Create
          </Button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {resolved.map(coll => (
          <div
            key={coll.id}
            onClick={() => openCollection(coll)}
            style={{
              cursor: 'pointer',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 14,
              padding: 16,
              position: 'relative',
            }}
          >
            {coll.persisted && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  deleteCollection(coll);
                }}
                style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'rgba(246,241,231,0.4)', cursor: 'pointer', fontSize: 12 }}
              >
                ✕
              </button>
            )}
            <div style={{ fontSize: 28, marginBottom: 8 }}>{coll.icon}</div>
            <Heading variant="headingMD" style={{ fontSize: 15, marginBottom: 4 }}>
              {coll.name}
            </Heading>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text variant="caption" style={{ color: 'var(--color-accent)', fontSize: 12 }}>
                {coll.memoryIds.length} {coll.memoryIds.length === 1 ? 'memory' : 'memories'}
              </Text>
              {coll.isSmart && (
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, backgroundColor: 'rgba(132,204,22,0.15)', color: '#84CC16', letterSpacing: '0.05em' }}>
                  SMART
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CollectionsPanel;
