import React, { useState, useEffect } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Quest } from '../../types/quest';
import { Memory, MemoryMood, MemoryVisibility, MemoryMedia, FirstTimeFlags } from '../../types/memory';
import { QuestSession } from '../quest-execution/questStateMachine';
import { Button } from '../../components/primitives/Button';
import { Heading, Text } from '../../components/primitives/Typography';
import { Card } from '../../components/primitives/Card';
import { MediaProcessor, ProcessedMedia } from './mediaProcessor';
import { mediaStorageService } from '../../services/media/mediaStorageService';
import { questSyncService } from '../../services/sync/questSyncService';
import { memoryRepository } from '../../repositories/MemoryRepository';
import { reflectionEnhancer } from '../../services/memories/reflectionEnhancer';
import { haptics } from '../../utils/haptics';
import { useAppState } from '../../context/AppStateContext';
import { getCurrentGPS } from '../../lib/native-device';
import { detectFirstTimeFlags, isFirstTimeExperience as computeIsFirstTime } from '../../services/memories/firstTimeDetection';
import { analytics } from '../../services/firebase/firebaseAnalytics';

interface ReflectionModalProps {
  quest: Quest;
  session: QuestSession;
  isOpen: boolean;
  onClose: () => void;
  onMemoryCreated: (memory: Memory) => void;
}

const ALL_MOODS: { id: MemoryMood; label: string; icon: string }[] = [
  { id: 'peaceful', label: 'Peaceful', icon: '🌿' },
  { id: 'inspired', label: 'Inspired', icon: '✨' },
  { id: 'calm', label: 'Calm', icon: '☕' },
  { id: 'surprised', label: 'Surprised', icon: '🔍' },
  { id: 'energized', label: 'Energized', icon: '⚡' },
  { id: 'happy', label: 'Happy', icon: '☀️' },
  { id: 'connected', label: 'Connected', icon: '🤝' },
  { id: 'neutral', label: 'Neutral', icon: '☁️' },
  { id: 'tired', label: 'Tired', icon: '🌙' },
  { id: 'disappointed', label: 'Disappointed', icon: '🌧️' },
];

export const ReflectionModal: React.FC<ReflectionModalProps> = ({
  quest,
  session,
  isOpen,
  onClose,
  onMemoryCreated,
}) => {
  const { city: appCity } = useAppState();
  const [memoryTitle, setMemoryTitle] = useState(quest.title);
  const [rating, setRating] = useState<number>(5);
  const [selectedMood, setSelectedMood] = useState<MemoryMood>('peaceful');
  const [reflectionText, setReflectionText] = useState<string>('');
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [visibility, setVisibility] = useState<MemoryVisibility>('private');
  const [mediaList, setMediaList] = useState<{ processed: ProcessedMedia; id: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [promptText, setPromptText] = useState<string>('What surprised you about this experience?');

  useEffect(() => {
    if (isOpen) {
      setMemoryTitle(quest.title);
      const prompts = reflectionEnhancer.getContextualPrompts(quest.category, selectedMood);
      setPromptText(prompts[Math.floor(Math.random() * prompts.length)]);
    }
  }, [isOpen, quest.category, selectedMood]);

  if (!isOpen) return null;

  const handlePickMedia = async (source: CameraSource) => {
    try {
      setUploadError(null);
      haptics.light();
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source,
      });

      if (image.webPath) {
        const response = await fetch(image.webPath);
        const blob = await response.blob();

        const validation = MediaProcessor.validateFile(blob as File);
        if (!validation.isValid) {
          setUploadError(validation.error || 'Invalid media file');
          return;
        }

        const isVideo = blob.type.startsWith('video/');
        const processed = isVideo
          ? await MediaProcessor.processVideo(blob as File)
          : await MediaProcessor.processImage(blob);

        setMediaList(prev => [
          ...prev,
          { processed, id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` }
        ]);
      }
    } catch {
      // User cancelled or picker unavailable
    }
  };

  const handleRemoveMedia = (index: number) => {
    haptics.light();
    setMediaList(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveMemory = async () => {
    haptics.success();
    setIsSaving(true);
    setUploadError(null);

    const memoryId = `mem_${Date.now()}`;
    const uploadedMediaItems: MemoryMedia[] = [];

    // Attempt uploading attached media to Firebase Storage / local fallback. Each
    // attempt emits privacy-safe telemetry (media KIND + byte size + attempt number
    // only — never the media itself) so upload reliability stays measurable.
    for (const item of mediaList) {
      const mediaKind = item.processed.type; // 'photo' | 'video'
      analytics.trackEvent('memory_media_upload_started', {
        media_kind: mediaKind,
        media_bytes: item.processed.sizeBytes,
        upload_attempt: 1,
      });
      try {
        const record = await mediaStorageService.uploadMemoryMedia(
          {
            userId: session.userId,
            memoryId,
            mediaId: item.id,
            processed: item.processed,
          },
          {
            // Each transient-failure retry is reported with its attempt number
            // only — the media itself is never part of the event. This lets us
            // measure how often the backoff schedule actually engages.
            onRetry: attempt => {
              analytics.trackEvent('memory_media_upload_retried', {
                media_kind: mediaKind,
                media_bytes: item.processed.sizeBytes,
                upload_attempt: attempt,
              });
            },
          }
        );
        uploadedMediaItems.push(record);
        if (record.status === 'uploaded') {
          analytics.trackEvent('memory_media_upload_succeeded', {
            media_kind: mediaKind,
            media_bytes: item.processed.sizeBytes,
            upload_attempt: 1,
          });
        } else {
          // The service exhausted its retry budget (or was cancelled) and kept a
          // local data-URL fallback instead of throwing. Report it honestly as a
          // failure so the success metric never counts bytes that never reached
          // Storage; the memory itself is preserved via the fallback record.
          analytics.trackEvent('memory_media_upload_failed', {
            media_kind: mediaKind,
            media_bytes: item.processed.sizeBytes,
            upload_attempt: 1,
            error_code: 'upload_failed',
          });
        }
      } catch (err) {
        // The memory is never lost on upload failure: keep the in-session data URL
        // as a local-only fallback and mark the record 'failed' for later retry.
        uploadedMediaItems.push({
          id: item.id,
          memoryId,
          userId: session.userId,
          type: item.processed.type,
          storagePath: '',
          downloadUrl: item.processed.dataUrl,
          thumbnailUrl: item.processed.thumbnailUrl,
          size: item.processed.sizeBytes,
          createdAt: new Date().toISOString(),
          status: 'failed',
        });
        analytics.trackEvent('memory_media_upload_failed', {
          media_kind: mediaKind,
          media_bytes: item.processed.sizeBytes,
          upload_attempt: 1,
          error_code: 'upload_exception',
        });
      }
    }

    // ─── Real location (best-effort) ──────────────────────────────────────────
    // City is a real signal: prefer the quest's city context, else the app's
    // current city. We never invent a place name from the quest title.
    const city = quest.cityContext?.[0] || appCity || 'Unknown location';

    // Coordinates: attempt a real GPS fix, rounded to ~110m and labelled
    // 'approximate' so a pinpoint location is never persisted. On denial/failure
    // we store 0/0, which LifeMap already treats as "unknown" (falls back to map
    // center) rather than a real point in the ocean.
    let coords = { lat: 0, lng: 0 };
    try {
      const gps = await getCurrentGPS();
      if (gps) {
        coords = {
          lat: Math.round(gps.lat * 1000) / 1000,
          lng: Math.round(gps.lng * 1000) / 1000,
        };
      }
    } catch {
      // permission denied / unavailable — keep the 0/0 unknown sentinel
    }

    // ─── Real first-time / new-place detection ────────────────────────────────
    // Compute against the user's OWN prior memories rather than the old always-true
    // flags. On any read error we fall back to an empty history — a genuine
    // first-time for a brand-new user, never a fabricated value.
    let priorMemories: Memory[] = [];
    try {
      const all = await memoryRepository.getMemories(session.userId);
      priorMemories = (all || []).filter(m => m.userId === session.userId && m.id !== memoryId);
    } catch {
      priorMemories = [];
    }
    const firstTimeFlags: FirstTimeFlags = detectFirstTimeFlags(priorMemories, {
      city,
      category: quest.category,
      tags: quest.tags,
    });
    const firstTime = computeIsFirstTime(firstTimeFlags);

    const photos = uploadedMediaItems.filter(m => m.type === 'photo');
    const videos = uploadedMediaItems.filter(m => m.type === 'video');
    const primaryPhotoUrl = photos.length > 0 ? photos[0].downloadUrl : undefined;

    const newMemory: Memory = {
      id: memoryId,
      userId: session.userId,
      questId: quest.id,
      questTitle: quest.title,
      title: memoryTitle || quest.title,
      description: quest.description,
      completedAt: new Date().toISOString(),
      startedAt: session.startedAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rating,
      moodRating: rating,
      mood: selectedMood,
      reflectionText: reflectionText.trim() || 'A meaningful moment experienced in the real world.',
      photos,
      videos,
      photoUrl: primaryPhotoUrl,
      location: {
        city,
        lat: coords.lat,
        lng: coords.lng,
        precision: 'approximate',
      },
      category: quest.category,
      visibility,
      isFavorite,
      isFirstTimeExperience: firstTime,
      firstTimeFlags,
      tags: quest.tags || ['experience', selectedMood],
    };

    // Save locally first so user memory is never lost even if network or upload fails
    await memoryRepository.saveMemory(session.userId, newMemory);

    questSyncService.enqueue({
      idempotencyKey: `memory_create_${memoryId}`,
      type: 'memory_creation',
      userId: session.userId,
      payload: newMemory,
    });

    // Privacy-safe creation telemetry: identifiers, a boolean, a city, a 1–5
    // rating — never the reflection text, title, or media.
    analytics.trackEvent('memory_created', {
      memory_id: memoryId,
      is_first_time: firstTime,
      city,
      mood_rating: rating,
    });
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      analytics.trackEvent('memory_draft_saved_offline', {
        memory_id: memoryId,
        is_offline: true,
      });
    }

    setIsSaving(false);
    onMemoryCreated(newMemory);
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
      {/* Header */}
      <div style={{ textAlign: 'center', margin: '16px 0 20px' }}>
        <Text variant="caption" style={{ color: '#C99A45', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>
          CREATING MEMORY
        </Text>
        <input
          type="text"
          value={memoryTitle}
          onChange={e => setMemoryTitle(e.target.value)}
          placeholder="Title your memory..."
          style={{
            fontFamily: 'serif',
            fontSize: '24px',
            fontWeight: 600,
            color: '#F6F1E7',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(201, 154, 69, 0.3)',
            textAlign: 'center',
            width: '100%',
            maxWidth: '360px',
            outline: 'none',
            padding: '4px 0',
            marginTop: '8px',
          }}
        />
      </div>

      {/* Experience Rating (1-5 Stars) */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <Text variant="label" style={{ color: 'rgba(246, 241, 231, 0.7)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
          HOW WAS THIS EXPERIENCE?
        </Text>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => {
                haptics.selection();
                setRating(star);
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '28px',
                color: star <= rating ? '#C99A45' : 'rgba(246, 241, 231, 0.2)',
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
              }}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Mood Selector */}
      <div style={{ marginBottom: '20px' }}>
        <Text variant="label" style={{ color: 'rgba(246, 241, 231, 0.8)', marginBottom: '8px', display: 'block' }}>
          PRIMARY EMOTIONAL MOOD
        </Text>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
          {ALL_MOODS.map(m => {
            const isSelected = selectedMood === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  haptics.selection();
                  setSelectedMood(m.id);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: isSelected ? '1px solid #C99A45' : '1px solid rgba(246, 241, 231, 0.15)',
                  backgroundColor: isSelected ? 'rgba(201, 154, 69, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  color: isSelected ? '#C99A45' : '#F6F1E7',
                  cursor: 'pointer',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reflection Text Input with Contextual Prompt */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <Text variant="label" style={{ color: 'rgba(246, 241, 231, 0.8)', fontSize: '12px' }}>
            YOUR REFLECTION
          </Text>
          <button
            onClick={() => {
              const prompts = reflectionEnhancer.getContextualPrompts(quest.category, selectedMood);
              setPromptText(prompts[Math.floor(Math.random() * prompts.length)]);
            }}
            style={{ background: 'none', border: 'none', color: '#C99A45', fontSize: '11px', cursor: 'pointer' }}
          >
            🎲 Change Prompt
          </button>
        </div>
        <Card style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px' }}>
          <Text variant="caption" style={{ color: '#84CC16', fontStyle: 'italic', marginBottom: '8px', display: 'block' }}>
            "{promptText}"
          </Text>
          <textarea
            value={reflectionText}
            onChange={e => setReflectionText(e.target.value)}
            placeholder="Write a sentence or short note..."
            rows={3}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#F6F1E7',
              fontSize: '14px',
              outline: 'none',
              resize: 'none',
              boxSizing: 'border-box',
            }}
          />
        </Card>
      </div>

      {/* Media Pickers (Camera / Gallery) */}
      <div style={{ marginBottom: '20px' }}>
        <Text variant="label" style={{ color: 'rgba(246, 241, 231, 0.8)', marginBottom: '8px', display: 'block' }}>
          CAPTURED MEDIA ({mediaList.length}/10)
        </Text>
        {uploadError && (
          <Text variant="caption" style={{ color: '#EF4444', marginBottom: '8px', display: 'block' }}>
            {uploadError}
          </Text>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {mediaList.map((item, idx) => (
            <div key={item.id} style={{ position: 'relative', height: '76px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
              <img src={item.processed.thumbnailUrl || item.processed.dataUrl} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {item.processed.type === 'video' && (
                <span style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '10px', background: 'rgba(0,0,0,0.6)', padding: '2px 4px', borderRadius: '4px' }}>
                  🎥 {item.processed.durationSeconds}s
                </span>
              )}
              <button
                onClick={() => handleRemoveMedia(idx)}
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  background: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
          ))}

          {mediaList.length < 10 && (
            <>
              <button
                onClick={() => handlePickMedia(CameraSource.Camera)}
                style={{
                  height: '76px',
                  border: '1px dashed rgba(201, 154, 69, 0.4)',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(201, 154, 69, 0.05)',
                  color: '#C99A45',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  gap: '4px',
                }}
              >
                <span style={{ fontSize: '18px' }}>📷</span>
                <span>Camera</span>
              </button>

              <button
                onClick={() => handlePickMedia(CameraSource.Photos)}
                style={{
                  height: '76px',
                  border: '1px dashed rgba(246, 241, 231, 0.2)',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  color: 'rgba(246, 241, 231, 0.7)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  gap: '4px',
                }}
              >
                <span style={{ fontSize: '18px' }}>🖼️</span>
                <span>Gallery</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Favorite & Privacy Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => {
            haptics.selection();
            setIsFavorite(prev => !prev);
          }}
          style={{
            background: isFavorite ? 'rgba(201, 154, 69, 0.2)' : 'none',
            border: isFavorite ? '1px solid #C99A45' : '1px solid rgba(255,255,255,0.15)',
            borderRadius: '20px',
            padding: '6px 14px',
            color: isFavorite ? '#C99A45' : 'rgba(246,241,231,0.7)',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>{isFavorite ? '★ Favorite Memory' : '☆ Mark as Favorite'}</span>
        </button>

        <button
          onClick={() => {
            haptics.selection();
            setVisibility(prev => (prev === 'private' ? 'shared' : 'private'));
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(246,241,231,0.6)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          🔒 Visibility: <strong style={{ color: '#F6F1E7' }}>{visibility.toUpperCase()}</strong>
        </button>
      </div>

      {/* Footer Actions */}
      <div style={{ marginTop: 'auto', display: 'flex', gap: '12px' }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>
          DISCARD
        </Button>
        <Button variant="primary" onClick={handleSaveMemory} disabled={isSaving} style={{ flex: 2 }}>
          {isSaving ? 'SAVING MEMORY...' : 'SAVE TO JOURNAL →'}
        </Button>
      </div>
    </div>
  );
};

export default ReflectionModal;
