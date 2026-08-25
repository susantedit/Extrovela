import React, { useState } from 'react';
import { Camera, Star, MapPin, Mic, Check, X, Sparkles, Navigation, Image as ImageIcon, ThumbsUp, ThumbsDown } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppState } from '../context/AppStateContext';
import { capturePhoto, getCurrentGPS, triggerHaptic } from '../lib/native-device';

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const PRESET_PHOTOS = [
  { name: 'Sunset', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80' },
  { name: 'Café', url: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=800&q=80' },
  { name: 'Beach', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80' },
  { name: 'Mountain', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80' },
  { name: 'Street', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80' },
];

const FEEDBACK_TAGS = [
  'Peaceful',
  'Scenic',
  'Too crowded',
  'Too expensive',
  'Too far',
  'Social',
  'Relaxing',
  'Unexpected',
  'Inspiring',
];

import { VoiceRecorder } from './VoiceRecorder';

export const CaptureModal: React.FC<CaptureModalProps> = ({ isOpen, onClose, onSaved }) => {
  const { activeQuest, city, addMemory } = useAppState();
  const [reflectionText, setReflectionText] = useState('');
  const [moodRating, setMoodRating] = useState(5);
  const [photoUrl, setPhotoUrl] = useState(PRESET_PHOTOS[0].url);
  const [placeName, setPlaceName] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [voiceAudioBase64, setVoiceAudioBase64] = useState<string>('');
  const [isLocating, setIsLocating] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [wouldDoAgain, setWouldDoAgain] = useState<'absolutely' | 'maybe' | 'never'>('absolutely');
  const [selectedFeedbackTags, setSelectedFeedbackTags] = useState<string[]>(['Peaceful']);

  if (!isOpen || !activeQuest) return null;

  const handleTakePhoto = async () => {
    setIsCapturing(true);
    triggerHaptic('light');
    const photo = await capturePhoto();
    if (photo) {
      setPhotoUrl(photo);
      triggerHaptic('success');
    }
    setIsCapturing(false);
  };

  const handleGetLocation = async () => {
    setIsLocating(true);
    triggerHaptic('light');
    const gps = await getCurrentGPS();
    if (gps) {
      setCoords({ lat: gps.lat, lng: gps.lng });
      setPlaceName(prev => prev || `GPS Location (${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)})`);
      triggerHaptic('success');
    } else {
      triggerHaptic('warning');
    }
    setIsLocating(false);
  };

  const toggleFeedbackTag = (tag: string) => {
    triggerHaptic('light');
    setSelectedFeedbackTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('success');
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });

    const defaultLat = city === 'Pokhara' ? 28.2096 : 27.7172;
    const defaultLng = city === 'Pokhara' ? 83.9575 : 85.3240;

    addMemory({
      userId: 'user_active',
      questId: activeQuest.id,
      questTitle: activeQuest.title,
      rating: moodRating,
      moodRating,
      reflectionText: reflectionText || 'Another story added to my real-world journal.',
      photoUrl,
      voiceNoteDuration: voiceAudioBase64 ? 15 : undefined,
      audioUrl: voiceAudioBase64 || undefined,
      location: {
        city,
        neighborhood: 'Local District',
        lat: coords?.lat || defaultLat,
        lng: coords?.lng || defaultLng,
        placeName: placeName || `${city} Discovery Point`,
      },
      visibility: 'private',
      isFavorite: false,
      createdAt: new Date().toISOString(),
      isFirstTimeExperience: isFirstTime,
      feedback: {
        wouldDoAgain,
        tags: selectedFeedbackTags,
      },
      tags: [activeQuest.category.toLowerCase(), city.toLowerCase(), ...selectedFeedbackTags.map(t => t.toLowerCase())],
    });
    onSaved();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card animate-slide-up" style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="modal-header">
          <h3 className="font-display">
            <Sparkles style={{ width: 18, height: 18, color: 'var(--accent-lime)' }} />
            Log Real-World Memory
          </h3>
          <button className="btn-icon" onClick={onClose} style={{ padding: 8 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Quest summary */}
        <div className="info-box info-box-quest mb-20">
          <span className="text-xs font-mono" style={{ color: 'var(--text-brand)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Completed Experience
          </span>
          <h4 className="font-display" style={{ fontSize: 17, marginTop: 4 }}>{activeQuest.title}</h4>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-20">
          {/* Photo Section */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <label className="form-label" style={{ marginBottom: 0 }}>
                <Camera style={{ color: 'var(--accent-lime)' }} /> Experience Snapshot
              </label>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleTakePhoto}
                style={{ padding: '6px 12px', fontSize: 11 }}
              >
                <Camera style={{ width: 13, height: 13 }} />
                <span>{isCapturing ? 'Opening Camera…' : 'Snap Photo / Gallery'}</span>
              </button>
            </div>

            <div style={{ position: 'relative', height: 180, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-glass)', marginBottom: 10 }}>
              <img src={photoUrl} alt="Memory Snapshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,9,13,0.7) 0%, transparent 60%)' }} />
            </div>

            <div className="photo-strip">
              {PRESET_PHOTOS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className={`photo-thumb ${photoUrl === p.url ? 'selected' : ''}`}
                  onClick={() => {
                    triggerHaptic('light');
                    setPhotoUrl(p.url);
                  }}
                >
                  <img src={p.url} alt={p.name} />
                </button>
              ))}
            </div>
          </div>

          {/* Mood Rating */}
          <div>
            <label className="form-label">How did it feel?</label>
            <div className="star-row">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  type="button"
                  className={`star-btn ${moodRating >= s ? 'filled' : ''}`}
                  onClick={() => {
                    triggerHaptic('light');
                    setMoodRating(s);
                  }}
                >
                  <Star style={{ fill: moodRating >= s ? 'currentColor' : 'none' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Deep Multi-Dimensional Feedback (Section 11) */}
          <div>
            <label className="form-label">What made it good or challenging?</label>
            <div className="chip-grid mb-12">
              {FEEDBACK_TAGS.map(tag => {
                const isSelected = selectedFeedbackTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`chip ${isSelected ? 'selected selected-lime' : ''}`}
                    onClick={() => toggleFeedbackTag(tag)}
                    style={{ fontSize: 11, padding: '6px 12px' }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-12 text-xs">
              <span className="text-muted font-bold">Would you do this again?</span>
              {(['absolutely', 'maybe', 'never'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  className={`chip ${wouldDoAgain === option ? 'selected selected-cyan' : ''}`}
                  onClick={() => {
                    triggerHaptic('light');
                    setWouldDoAgain(option);
                  }}
                  style={{ fontSize: 11, padding: '4px 10px', textTransform: 'capitalize' }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Reflection */}
          <div>
            <label className="form-label">Personal Reflection</label>
            <textarea
              className="form-input"
              rows={2}
              value={reflectionText}
              onChange={e => setReflectionText(e.target.value)}
              placeholder="What surprised you? What did you discover?"
            />
          </div>

          {/* Voice Ambient Reflection */}
          <VoiceRecorder
            onAudioSaved={audioBase64 => setVoiceAudioBase64(audioBase64)}
          />

          {/* Place & GPS Location */}
          <div className="grid-2">
            <div>
              <div className="flex items-center justify-between mb-8">
                <label className="form-label" style={{ marginBottom: 0 }}>
                  <MapPin style={{ color: 'var(--accent-sunset)' }} /> Location Name
                </label>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={handleGetLocation}
                  style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-cyan)' }}
                >
                  <Navigation style={{ width: 11, height: 11 }} />
                  <span>{isLocating ? 'Locating…' : 'GPS Auto-Fill'}</span>
                </button>
              </div>
              <input
                type="text"
                className="form-input"
                value={placeName}
                onChange={e => setPlaceName(e.target.value)}
                placeholder="e.g. Swayambhunath Hill"
              />
            </div>
          </div>

          {/* First Time Checkbox */}
          <div className="checkbox-row">
            <input
              type="checkbox"
              id="firstTime"
              checked={isFirstTime}
              onChange={e => {
                triggerHaptic('light');
                setIsFirstTime(e.target.checked);
              }}
            />
            <label htmlFor="firstTime">Mark as "First-Time Experience"</label>
          </div>

          {/* Actions */}
          <div className="flex gap-12" style={{ paddingTop: 4 }}>
            <button type="button" className="btn btn-glass" onClick={onClose} style={{ fontSize: 12 }}>Cancel</button>
            <button type="submit" className="btn btn-primary flex-1">
              <Check style={{ width: 16, height: 16 }} />
              <span>Save & Train Experience Graph</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
