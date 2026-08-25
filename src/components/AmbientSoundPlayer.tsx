import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Music, CloudRain, Wind, Coffee, Flame, X, Play, Pause } from 'lucide-react';
import { triggerHaptic } from '../lib/native-device';

export type SoundscapeType = 'rain' | 'wind' | 'cafe' | 'fireplace';

interface SoundscapeTrack {
  id: SoundscapeType;
  name: string;
  icon: React.ElementType;
  color: string;
}

const TRACKS: SoundscapeTrack[] = [
  { id: 'rain', name: 'Gentle Rain', icon: CloudRain, color: '#60A5FA' },
  { id: 'wind', name: 'Mountain Wind', icon: Wind, color: '#A7F3D0' },
  { id: 'cafe', name: 'Cozy Café', icon: Coffee, color: '#F59E0B' },
  { id: 'fireplace', name: 'Warm Hearth', icon: Flame, color: '#EF4444' },
];

export const AmbientSoundPlayer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrack, setActiveTrack] = useState<SoundscapeType>('rain');
  const [volume, setVolume] = useState(0.5);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<AudioNode | null>(null);

  // Initialize Web Audio API Procedural Sound Engine
  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // Ignore
      }
      sourceNodeRef.current = null;
    }
  };

  const startProceduralSound = (type: SoundscapeType) => {
    stopAudio();

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(ctx.destination);
      gainNodeRef.current = masterGain;

      // Create Noise Buffer (5 seconds loop)
      const bufferSize = ctx.sampleRate * 5;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Pink/Brown Noise Generation
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Filter settings based on soundscape type
      const filter = ctx.createBiquadFilter();
      if (type === 'rain') {
        filter.type = 'lowpass';
        filter.frequency.value = 1200;
      } else if (type === 'wind') {
        filter.type = 'bandpass';
        filter.frequency.value = 400;
        filter.Q.value = 3.0;
      } else if (type === 'cafe') {
        filter.type = 'lowpass';
        filter.frequency.value = 800;
      } else {
        // Fireplace crackle
        filter.type = 'lowpass';
        filter.frequency.value = 600;
      }

      whiteNoise.connect(filter);
      filter.connect(masterGain);
      whiteNoise.start();
      sourceNodeRef.current = whiteNoise;
    } catch {
      // Fail clean fallback
    }
  };

  const togglePlay = () => {
    triggerHaptic('medium');
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
    } else {
      startProceduralSound(activeTrack);
      setIsPlaying(true);
    }
  };

  const handleSelectTrack = (trackId: SoundscapeType) => {
    triggerHaptic('light');
    setActiveTrack(trackId);
    if (isPlaying) {
      startProceduralSound(trackId);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVol;
    }
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  return (
    <div style={{ position: 'fixed', bottom: 84, right: 20, zIndex: 900 }}>
      {!isOpen ? (
        <button
          onClick={() => {
            triggerHaptic('light');
            setIsOpen(true);
          }}
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: isPlaying ? 'var(--color-accent)' : 'var(--color-surface)',
            color: isPlaying ? '#171813' : 'var(--color-text)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Ambient Soundscapes"
        >
          <Music size={20} />
        </button>
      ) : (
        <div
          className="animate-scale-in"
          style={{
            width: 280,
            backgroundColor: '#22231D',
            border: '1px solid rgba(201, 154, 69, 0.4)',
            borderRadius: 20,
            padding: 16,
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            color: '#F6F1E7',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#C99A45' }}>
              <Music size={14} />
              <span>AMBIENT SOUNDSCAPE</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.6)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Track Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {TRACKS.map(t => {
              const Icon = t.icon;
              const isSelected = activeTrack === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTrack(t.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 10,
                    backgroundColor: isSelected ? 'rgba(201, 154, 69, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: isSelected ? '1px solid #C99A45' : '1px solid transparent',
                    color: isSelected ? '#F6F1E7' : 'rgba(246, 241, 231, 0.7)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Icon size={14} style={{ color: t.color }} />
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>

          {/* Controls: Play/Pause & Volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={togglePlay}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: isPlaying ? '#EF4444' : 'var(--color-accent)',
                border: 'none',
                color: isPlaying ? '#FFF' : '#171813',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              {volume === 0 ? <VolumeX size={14} style={{ color: 'rgba(246,241,231,0.5)' }} /> : <Volume2 size={14} style={{ color: '#C99A45' }} />}
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#C99A45', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AmbientSoundPlayer;
