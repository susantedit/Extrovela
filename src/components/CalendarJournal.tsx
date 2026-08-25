import React, { useState } from 'react';
import { Calendar as CalendarIcon, MapPin, Star, Eye, Share2 } from 'lucide-react';
import { useAppState } from '../context/AppStateContext';
import { Memory } from '../types';
import { ShareStoryModal } from './ShareStoryModal';
import { triggerHaptic } from '../lib/native-device';

export const CalendarJournal: React.FC = () => {
  const { memories, stats } = useAppState();
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [sharingMemory, setSharingMemory] = useState<Memory | null>(null);
  const [filterTag, setFilterTag] = useState<string>('all');

  const filtered = memories.filter(m => {
    if (filterTag === 'all') return true;
    if (filterTag === 'first-time') return m.isFirstTimeExperience;
    return m.tags.includes(filterTag);
  });

  return (
    <div className="container py-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-24" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 className="font-display flex items-center gap-12" style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800 }}>
            <CalendarIcon style={{ width: 28, height: 28, color: 'var(--accent-lime)' }} />
            Memory Journal
          </h2>
          <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
            Every completed quest becomes a story.
          </p>
        </div>

        <div className="flex gap-8">
          {[
            { key: 'all', label: `All (${memories.length})` },
            { key: 'first-time', label: 'First-Times' },
            { key: 'sunset', label: 'Sunsets' },
          ].map(f => (
            <button
              key={f.key}
              className={`chip ${filterTag === f.key ? 'selected selected-lime' : ''}`}
              onClick={() => setFilterTag(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Grid */}
      <div className="grid-3">
        {filtered.map(m => (
          <div
            key={m.id}
            className="glass-card glass-card-interactive"
            onClick={() => setSelectedMemory(m)}
            style={{ cursor: 'pointer' }}
          >
            {/* Photo */}
            <div className="memory-photo">
              <img src={m.photoUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb'} alt={m.questTitle} />
              <div className="memory-photo-overlay" />
              <div className="memory-date-badge">
                <CalendarIcon />
                <span>{new Date(m.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              {m.isFirstTimeExperience && <div className="first-time-badge">First Time</div>}
              <div className="memory-stars">
                {[...Array(m.moodRating)].map((_, i) => (
                  <Star key={i} />
                ))}
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: 20 }}>
              <h3 className="font-display" style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{m.questTitle}</h3>
              <p className="text-secondary text-sm line-clamp-2" style={{ fontStyle: 'italic', lineHeight: 1.5 }}>
                "{m.reflectionText}"
              </p>
              <div className="flex items-center justify-between border-top" style={{ paddingTop: 14, marginTop: 14 }}>
                <span className="flex items-center gap-8 text-xs" style={{ color: 'var(--accent-sunset)' }}>
                  <MapPin style={{ width: 13, height: 13 }} />
                  {m.location.placeName || m.location.city}
                </span>
                <span className="flex items-center gap-8 text-xs text-brand">
                  <Eye style={{ width: 13, height: 13 }} /> View Story
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedMemory && (
        <div className="modal-overlay" onClick={() => setSelectedMemory(null)}>
          <div className="modal-card animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="flex items-center justify-between mb-16">
              <span className="font-mono text-xs text-lime">{new Date(selectedMemory.completedAt).toLocaleString()}</span>
              <div className="flex items-center gap-8">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    triggerHaptic('medium');
                    setSharingMemory(selectedMemory);
                  }}
                  style={{ padding: '6px 12px', fontSize: 11 }}
                >
                  <Share2 style={{ width: 13, height: 13 }} />
                  <span>Share 9:16 Story</span>
                </button>
                <button className="btn-ghost text-xs" onClick={() => setSelectedMemory(null)}>Close</button>
              </div>
            </div>

            <div style={{ height: 260, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-glass)', marginBottom: 20 }}>
              <img src={selectedMemory.photoUrl} alt={selectedMemory.questTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            <h2 className="font-display" style={{ fontSize: 28, fontWeight: 900, marginBottom: 10 }}>{selectedMemory.questTitle}</h2>
            <div className="flex items-center gap-8 mb-16">
              <div className="flex gap-8">
                {[...Array(selectedMemory.moodRating)].map((_, i) => (
                  <Star key={i} style={{ width: 16, height: 16, fill: 'var(--accent-gold)', color: 'var(--accent-gold)' }} />
                ))}
              </div>
              <span className="font-mono text-xs text-muted">• {selectedMemory.location.placeName}</span>
            </div>

            <div className="info-box info-box-quest mb-16">
              <h4 className="form-label" style={{ marginBottom: 8 }}>Personal Reflection</h4>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{selectedMemory.reflectionText}</p>
            </div>

            {selectedMemory.feedback && (
              <div className="flex flex-wrap gap-6">
                {selectedMemory.feedback.tags.map(t => (
                  <span key={t} className="pill pill-brand" style={{ fontSize: 10 }}>✓ {t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 9:16 Story Share Modal */}
      <ShareStoryModal
        isOpen={!!sharingMemory}
        onClose={() => setSharingMemory(null)}
        memory={sharingMemory}
        mode="memory"
      />
    </div>
  );
};
