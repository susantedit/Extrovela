import React, { useState } from 'react';
import { Memory } from '../../types/memory';
import { Heading, Text } from '../../components/primitives/Typography';
import { Button } from '../../components/primitives/Button';
import { Card } from '../../components/primitives/Card';
import { haptics } from '../../utils/haptics';
import { ShareCardModal } from './ShareCardModal';
import { ShareableSubject } from '../../types/share';

interface MemoryDetailModalProps {
  memory: Memory | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteMemory?: (memoryId: string) => void;
  onToggleFavorite?: (memoryId: string) => void;
  userId?: string | null;
}

export const MemoryDetailModal: React.FC<MemoryDetailModalProps> = ({
  memory,
  isOpen,
  onClose,
  onDeleteMemory,
  onToggleFavorite,
  userId,
}) => {
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'photo' | 'video' } | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showShare, setShowShare] = useState(false);

  if (!isOpen || !memory) return null;

  const dateStr = new Date(memory.completedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const displayTitle = memory.title || memory.questTitle;
  const ratingStars = memory.rating || memory.moodRating || 5;
  const photos = memory.photos || [];
  const videos = memory.videos || [];
  const allMedia = [...photos, ...videos];
  const heroImage = memory.photoUrl || (photos.length > 0 ? photos[0].downloadUrl : undefined);
  // If a memory has no photo but does have video, the first video is the hero.
  const heroVideo = !heroImage && videos.length > 0 ? videos[0] : undefined;

  // A share subject carries ONLY approved, non-sensitive fields: title, a
  // month/year subtitle, a city-level place label, and stat lines. The exact
  // coordinates, media, and full private reflection are deliberately excluded —
  // the reflection text never leaves the device through this path.
  const shareSubject: ShareableSubject = {
    type: 'memory',
    title: displayTitle,
    subtitle: new Date(memory.completedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    statLines: [
      `Rated ${ratingStars}/5`,
      memory.isFirstTimeExperience ? 'First-time experience' : '',
      memory.mood ? `Felt ${memory.mood}` : '',
      memory.category ? `${memory.category}` : '',
    ].filter(Boolean),
    placeLabel: memory.location.city,
    dateLabel: new Date(memory.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  };

  const handleDelete = () => {
    haptics.medium();
    if (onDeleteMemory) {
      onDeleteMemory(memory.id);
    }
    setShowConfirmDelete(false);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18, 19, 15, 0.98)',
        backdropFilter: 'blur(24px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 20px',
        color: '#F6F1E7',
        overflowY: 'auto',
      }}
    >
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Text variant="caption" style={{ color: '#C99A45', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
            STORY MEMORY
          </Text>
          {memory.isFavorite && <span style={{ color: '#C99A45', fontSize: '14px' }}>★ Favorite</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => {
              haptics.selection();
              if (onToggleFavorite) onToggleFavorite(memory.id);
            }}
            style={{ background: 'none', border: 'none', color: '#C99A45', fontSize: '18px', cursor: 'pointer' }}
          >
            {memory.isFavorite ? '★' : '☆'}
          </button>
          <button
            onClick={() => {
              haptics.selection();
              setShowShare(true);
            }}
            title="Share as card"
            style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.7)', fontSize: '16px', cursor: 'pointer' }}
          >
            ↗
          </button>
          <button
            onClick={() => setShowConfirmDelete(true)}
            style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '14px', cursor: 'pointer' }}
          >
            🗑️
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.6)', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Hero Media Display */}
      {heroImage ? (
        <div
          onClick={() => setSelectedMedia({ url: heroImage, type: 'photo' })}
          style={{ width: '100%', height: '260px', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px', cursor: 'pointer' }}
        >
          <img src={heroImage} alt={displayTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : heroVideo ? (
        <div style={{ width: '100%', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px', backgroundColor: '#000' }}>
          <video
            src={heroVideo.downloadUrl}
            poster={heroVideo.thumbnailUrl}
            controls
            playsInline
            preload="metadata"
            style={{ width: '100%', maxHeight: '360px', display: 'block' }}
          />
        </div>
      ) : null}

      {/* Additional Media Gallery Grid */}
      {allMedia.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
          {allMedia.map(m => (
            <div
              key={m.id}
              onClick={() => setSelectedMedia({ url: m.downloadUrl, type: m.type })}
              style={{ height: '64px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', backgroundColor: '#000' }}
            >
              {m.thumbnailUrl || m.type === 'photo' ? (
                <img src={m.thumbnailUrl || m.downloadUrl} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%' }} />
              )}
              {m.type === 'video' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: '18px', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>▶</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Title & Metadata */}
      <Heading variant="headingLG" style={{ color: '#F6F1E7', fontFamily: 'serif', marginBottom: '8px' }}>
        {displayTitle}
      </Heading>

      <Text variant="caption" style={{ color: 'rgba(246, 241, 231, 0.6)', marginBottom: '16px', display: 'block' }}>
        {dateStr} • {memory.location.city} {memory.location.placeName ? `(${memory.location.placeName})` : ''}
      </Text>

      {/* Rating & Mood Badges */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ color: '#C99A45', fontSize: '18px', letterSpacing: '2px' }}>{'★'.repeat(ratingStars)}</div>
        {memory.mood && (
          <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(201, 154, 69, 0.15)', color: '#C99A45', textTransform: 'capitalize' }}>
            Feeling: {memory.mood}
          </span>
        )}
        {memory.isFirstTimeExperience && (
          <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(132, 204, 22, 0.15)', color: '#84CC16', border: '1px solid rgba(132, 204, 22, 0.3)' }}>
            ✨ First Time Experience
          </span>
        )}
      </div>

      {/* Reflection Note */}
      <Card
        style={{
          backgroundColor: 'rgba(32, 33, 27, 0.8)',
          borderRadius: '14px',
          padding: '20px',
          border: '1px solid rgba(201, 154, 69, 0.2)',
          marginBottom: '20px',
        }}
      >
        <Text variant="label" style={{ color: '#C99A45', marginBottom: '8px', display: 'block', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.1em' }}>
          PERSONAL REFLECTION
        </Text>
        <Text style={{ color: '#F6F1E7', fontSize: '16px', lineHeight: 1.6, fontStyle: 'italic' }}>
          "{memory.reflectionText}"
        </Text>
      </Card>

      {/* Tags */}
      {memory.tags && memory.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {memory.tags.map(t => (
            <span key={t} style={{ fontSize: '12px', color: 'rgba(246, 241, 231, 0.6)', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '4px 10px', borderRadius: '10px' }}>
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Full Screen Media Viewer Overlay */}
      {selectedMedia && (
        <div
          onClick={() => setSelectedMedia(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          {selectedMedia.type === 'video' ? (
            <video
              src={selectedMedia.url}
              controls
              autoPlay
              playsInline
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, backgroundColor: '#000' }}
            />
          ) : (
            <img src={selectedMedia.url} alt="Full screen preview" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showConfirmDelete && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Card style={{ backgroundColor: '#20211B', border: '1px solid var(--color-border)', maxWidth: 360, width: '100%', padding: 20 }}>
            <Heading variant="headingMD" style={{ color: '#F6F1E7', marginBottom: 8 }}>
              Delete Memory?
            </Heading>
            <Text variant="bodySM" color="secondary" style={{ marginBottom: 16 }}>
              This will permanently delete your reflection, photos, and journal entry.
            </Text>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowConfirmDelete(false)} style={{ flex: 1 }}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} style={{ flex: 1 }}>
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Close button */}
      <div style={{ marginTop: 'auto' }}>
        <Button variant="secondary" onClick={onClose} style={{ width: '100%' }}>
          CLOSE JOURNAL
        </Button>
      </div>

      {/* Share as public card */}
      <ShareCardModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        subject={shareSubject}
        subjectType="memory"
        subjectId={memory.id}
        userId={userId ?? null}
      />
    </div>
  );
};

export default MemoryDetailModal;
