import React, { useState, useEffect } from 'react';
import { Sparkles, PhoneOff, Clock, Sun, Share2, CheckCircle2 } from 'lucide-react';
import { useAppState } from '../context/AppStateContext';

interface ActiveQuestCardProps {
  onComplete: () => void;
}

export const ActiveQuestCard: React.FC<ActiveQuestCardProps> = ({ onComplete }) => {
  const { activeQuest, city, isPhoneFreeMode, setIsPhoneFreeMode, setCoQuestModalQuest } = useAppState();
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setSecondsElapsed(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!activeQuest) {
    return (
      <div className="container py-32 text-center" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Sparkles style={{ width: 28, height: 28, color: 'var(--accent-lime)', opacity: 0.5 }} />
        </div>
        <h3 className="font-display" style={{ fontSize: 24, marginBottom: 8 }}>No Quest Active</h3>
        <p className="text-secondary text-sm">
          Pick a quest from the <strong className="text-lime">Discover Quests</strong> tab.
        </p>
      </div>
    );
  }

  const mins = Math.floor(secondsElapsed / 60);
  const secs = secondsElapsed % 60;
  const timerStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="container py-32" style={{ maxWidth: 840 }}>
      {/* Phone-Free Banner */}
      {isPhoneFreeMode && (
        <div className="phone-free-banner mb-24 animate-slide-up">
          <div className="flex items-center gap-12">
            <div className="phone-free-icon animate-pulse-ring">
              <PhoneOff style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <h4 className="font-display" style={{ fontSize: 14 }}>Phone-Free Sanctuary</h4>
              <p className="text-secondary text-xs">Experience your surroundings directly.</p>
            </div>
          </div>
          <button className="btn-ghost text-xs" onClick={() => setIsPhoneFreeMode(false)}>Exit</button>
        </div>
      )}

      {/* Hero Quest Card */}
      <div className="glass-card" style={{ padding: 'clamp(24px, 5vw, 44px)', borderColor: 'rgba(132, 204, 22, 0.25)' }}>
        <div className="ambient-glow ambient-glow-top" />

        {/* Status */}
        <div className="flex items-center justify-between border-bottom" style={{ paddingBottom: 20, marginBottom: 28, position: 'relative', zIndex: 1 }}>
          <div className="flex items-center gap-8">
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-emerald)', boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)' }} />
            <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent-emerald)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              In Progress • {city}
            </span>
          </div>
          <div className="flex items-center gap-8">
            <button
              className={`btn ${isPhoneFreeMode ? 'btn-primary' : 'btn-glass'}`}
              style={{ padding: '7px 14px', fontSize: 12 }}
              onClick={() => setIsPhoneFreeMode(!isPhoneFreeMode)}
            >
              <PhoneOff style={{ width: 14, height: 14 }} />
              <span>Phone-Free</span>
            </button>
            <button className="btn-icon" onClick={() => setCoQuestModalQuest(activeQuest)}>
              <Share2 style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Title */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 28 }}>
          <span className="pill pill-brand mb-12">{activeQuest.category} • {activeQuest.time}</span>
          <h2 className="font-display" style={{ fontSize: 'clamp(26px, 4.5vw, 44px)', fontWeight: 900, marginTop: 12, lineHeight: 1.1 }}>
            {activeQuest.title}
          </h2>
          <p className="text-secondary" style={{ fontSize: 16, lineHeight: 1.65, marginTop: 14, maxWidth: 560 }}>
            {activeQuest.description}
          </p>
        </div>

        {/* Timer + Context */}
        <div className="grid-2" style={{ position: 'relative', zIndex: 1, marginBottom: 28, background: 'var(--bg-glass)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)' }}>
          <div className="context-meter">
            <div className="context-meter-icon" style={{ background: 'var(--accent-lime-glow)', border: '1px solid rgba(132, 204, 22, 0.3)', color: 'var(--accent-lime)' }}>
              <Clock />
            </div>
            <div>
              <p className="form-label" style={{ marginBottom: 4 }}>Timer</p>
              <span className="timer-display">{timerStr}</span>
            </div>
          </div>

          <div className="context-meter">
            <div className="context-meter-icon" style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--accent-sunset)' }}>
              <Sun />
            </div>
            <div>
              <p className="form-label" style={{ marginBottom: 4 }}>Context</p>
              <h4 className="font-display text-gold" style={{ fontSize: 14 }}>Golden Hour Approaching</h4>
              <p className="text-muted text-xs">Sunset at 6:42 PM in {city}</p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 28 }}>
          <h4 className="form-label mb-12">Step-by-Step Guidance</h4>
          <div className="flex flex-col gap-8">
            {[
              'Put away distractions and focus on the immediate sensory world around you.',
              'Fulfill the core experience at your own peaceful pace.',
              'Capture a photo, record a reflection, and log your memory.'
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-8" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--accent-emerald)', marginTop: 2, flexShrink: 0 }} />
                <span>Step {i + 1}: {step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <button className="btn btn-primary btn-lg" onClick={onComplete}>
            <Sparkles />
            <span>Complete Experience & Capture Memory</span>
          </button>
        </div>
      </div>
    </div>
  );
};
