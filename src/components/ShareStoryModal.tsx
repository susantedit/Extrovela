import React, { useRef } from 'react';
import { Share2, X, Sparkles, MapPin, Calendar, Heart, Download } from 'lucide-react';
import { Memory, UserStats } from '../types';
import { triggerHaptic } from '../lib/native-device';
import { useCustomAlert } from '../context/CustomAlertContext';

interface ShareStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory?: Memory | null;
  stats?: UserStats | null;
  mode: 'memory' | 'recap';
}

export const ShareStoryModal: React.FC<ShareStoryModalProps> = ({ isOpen, onClose, memory, stats, mode }) => {
  const { showToast } = useCustomAlert();
  const cardRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleDownloadCanvas = () => {
    triggerHaptic('medium');
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
    bgGrad.addColorStop(0, '#08090D');
    bgGrad.addColorStop(0.5, '#171813');
    bgGrad.addColorStop(1, '#08090D');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Accent header
    ctx.fillStyle = '#CCFF00';
    ctx.font = 'bold 36px monospace';
    ctx.fillText('EXTROVELA • REAL WORLD MEMORY', 80, 160);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 64px sans-serif';
    const titleText = memory ? memory.questTitle : 'My Exploration Journey';
    ctx.fillText(titleText.substring(0, 32), 80, 260);

    // Location
    if (memory?.location?.placeName) {
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '36px sans-serif';
      ctx.fillText(`📍 ${memory.location.placeName}`, 80, 330);
    }

    // Story image (drawn if available or placeholder stylized box)
    ctx.fillStyle = '#1F2937';
    // @ts-ignore
    ctx.roundRect(80, 400, 920, 920, 32);
    ctx.fill();

    ctx.fillStyle = '#CCFF00';
    ctx.font = '48px sans-serif';
    ctx.fillText('✨ Experience Completed', 140, 880);

    // Reflection quote
    if (memory?.reflectionText) {
      ctx.fillStyle = '#E5E7EB';
      ctx.font = 'italic 36px sans-serif';
      ctx.fillText(`"${memory.reflectionText.substring(0, 60)}..."`, 80, 1420);
    }

    // Footer branding
    ctx.fillStyle = '#6B7280';
    ctx.font = '32px sans-serif';
    ctx.fillText('Created with EXTROVELA — Breaking daily routine', 80, 1800);

    // Trigger download
    const link = document.createElement('a');
    link.download = `extrovela-story-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast({ message: 'Story image generated and downloaded!', type: 'success' });
  };

  const handleShare = async () => {
    triggerHaptic('light');
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'EXTROVELA Adventure',
          text: memory ? `Completed quest: ${memory.questTitle}!` : 'Check out my EXTROVELA recap!',
          url: window.location.origin,
        });
      } catch {
        // Share cancelled or unhandled
      }
    } else {
      await navigator.clipboard.writeText(window.location.origin);
      showToast({ message: 'Link copied to clipboard!', type: 'success' });
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-card animate-slide-up" style={{ maxWidth: 440, padding: 24 }}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-8">
            <Sparkles style={{ width: 18, height: 18, color: 'var(--accent-lime)' }} />
            <h3 className="font-display">9:16 Social Story Card</h3>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ padding: 8 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* 9:16 Canvas Preview Card */}
        <div
          ref={cardRef}
          style={{
            width: '100%',
            aspectRatio: '9 / 16',
            maxHeight: 520,
            borderRadius: 24,
            overflow: 'hidden',
            position: 'relative',
            background: '#08090D',
            border: '2px solid rgba(132, 204, 22, 0.4)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.8), 0 0 32px var(--accent-lime-glow)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 24,
            margin: '0 auto 20px',
          }}
        >
          {/* Background Photo & Glow */}
          {mode === 'memory' && memory?.photoUrl && (
            <img
              src={memory.photoUrl}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.45,
                filter: 'saturate(1.2) contrast(1.1)',
              }}
            />
          )}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(8,9,13,0.85) 0%, rgba(8,9,13,0.3) 40%, rgba(8,9,13,0.95) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Top Branding */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <img src="/logo.png" alt="EXTROVELA" style={{ height: 26, width: 'auto' }} />
            <span
              className="font-mono text-xs"
              style={{
                background: 'rgba(255,255,255,0.08)',
                padding: '4px 10px',
                borderRadius: 99,
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--accent-lime)',
                fontWeight: 700,
              }}
            >
              REAL-WORLD EXPERIENCE
            </span>
          </div>

          {/* Main Story Content */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            {mode === 'memory' && memory ? (
              <div>
                {memory.isFirstTimeExperience && (
                  <div className="pill mb-12" style={{ background: 'var(--accent-sunset)', color: '#fff', fontSize: 10, fontWeight: 800 }}>
                    FIRST-TIME EXPERIENCE
                  </div>
                )}
                <h2 className="font-display" style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.15, marginBottom: 12, color: '#fff' }}>
                  {memory.questTitle}
                </h2>
                <p style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--text-primary)', opacity: 0.9, lineHeight: 1.5, marginBottom: 16 }}>
                  "{memory.reflectionText}"
                </p>
                <div className="flex items-center gap-12 font-mono text-xs" style={{ color: 'var(--accent-lime)' }}>
                  <span className="flex items-center gap-4">
                    <MapPin style={{ width: 12, height: 12 }} />
                    {memory.location.placeName || memory.location.city}
                  </span>
                  <span className="text-muted">•</span>
                  <span>{new Date(memory.completedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ) : (
              <div>
                <span className="pill pill-brand mb-12">MONTHLY STORY RECAP</span>
                <h2 className="font-display" style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.15, marginBottom: 16, color: '#fff' }}>
                  You explored more than you expected.
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: 'rgba(255,255,255,0.06)', padding: 12, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="font-display" style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-lime)' }}>{stats?.totalQuestsCompleted}</div>
                    <div className="text-muted text-xs font-bold uppercase">Experiences</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', padding: 12, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="font-display" style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-sunset)' }}>{stats?.firstTimeCount}</div>
                    <div className="text-muted text-xs font-bold uppercase">First-Times</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', padding: 12, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="font-display" style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-cyan)' }}>{stats?.uniqueLocationsVisited}</div>
                    <div className="text-muted text-xs font-bold uppercase">New Places</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', padding: 12, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="font-display" style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-gold)' }}>{stats?.routineBreakerStreak}d</div>
                    <div className="text-muted text-xs font-bold uppercase">Streak</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Footer Call to Action */}
          <div style={{ position: 'relative', zIndex: 2, borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span className="font-bold text-xs" style={{ color: '#fff' }}>EXTROVELA</span>
              <span className="text-muted text-xs" style={{ display: 'block' }}>Make today different.</span>
            </div>
            <span className="font-mono text-xs text-lime" style={{ fontWeight: 700 }}>extrovela.app</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary flex-1 btn-lg" onClick={handleDownloadCanvas} style={{ justifyContent: 'center' }}>
            <Download style={{ width: 16, height: 16 }} />
            <span>Save 9:16 Image</span>
          </button>
          <button className="btn btn-secondary flex-1 btn-lg" onClick={handleShare} style={{ justifyContent: 'center' }}>
            <Share2 style={{ width: 16, height: 16 }} />
            <span>Share</span>
          </button>
        </div>
      </div>
    </div>
  );
};
