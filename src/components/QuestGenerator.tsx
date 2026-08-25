import React, { useState, useEffect } from 'react';
import { Compass, Clock, Zap, Smile, DollarSign, Home, Users, Sparkles, ArrowRight, Share2, MapPin, Dice5, Moon, Layers, AlertCircle } from 'lucide-react';
import { useAppState } from '../context/AppStateContext';
import { TimeOption, Energy, Mood, Budget, Environment, SocialPref, Quest } from '../types';
import { triggerHaptic, scheduleQuestTimerNotification } from '../lib/native-device';

interface QuestGeneratorProps {
  onQuestSelected: () => void;
}

const TIME_OPTIONS: TimeOption[] = ['15 mins', '30 mins', '1 hour', '2+ hours', 'Full day'];
const ENERGY_OPTIONS: Energy[] = ['Chill', 'Moderate', 'High Energy', 'Adventurous'];
const MOOD_OPTIONS: Mood[] = ['Reflective', 'Curious', 'Playful', 'Social', 'Peaceful', 'Spontaneous'];
const BUDGET_OPTIONS: Budget[] = ['Free', 'Low ($)', 'Moderate ($$)', 'Treat Myself ($$$)'];
const ENV_OPTIONS: Environment[] = ['Outdoor', 'Indoor', 'Urban Street', 'Nature', 'Cozy Local Spot'];
const SOCIAL_OPTIONS: SocialPref[] = ['Solo', 'Low-pressure social', 'With a friend', 'Group adventure'];

export const QuestGenerator: React.FC<QuestGeneratorProps> = ({ onQuestSelected }) => {
  const {
    city,
    season,
    generateQuests,
    generatedOptions,
    setActiveQuest,
    setCoQuestModalQuest,
    triggerQuickMode,
    antiRepetitionNudge,
  } = useAppState();

  const [time, setTime] = useState<TimeOption>('1 hour');
  const [energy, setEnergy] = useState<Energy>('Chill');
  const [mood, setMood] = useState<Mood>('Reflective');
  const [budget, setBudget] = useState<Budget>('Free');
  const [environment, setEnvironment] = useState<Environment>('Outdoor');
  const [social, setSocial] = useState<SocialPref>('Solo');
  const [activeQuickMode, setActiveQuickMode] = useState<string | null>(null);

  useEffect(() => {
    generateQuests({ time, energy, mood, budget, social, environment });
  }, []);

  const handleGenerate = () => {
    triggerHaptic('medium');
    generateQuests({ time, energy, mood, budget, social, environment });
  };

  const handleQuickMode = (mode: 'room_escape' | 'bored' | 'wildcard' | 'tonight' | 'chain') => {
    triggerHaptic('medium');
    setActiveQuickMode(mode);
    triggerQuickMode(mode);
  };

  const handleAccept = (quest: Quest) => {
    triggerHaptic('success');
    setActiveQuest(quest);

    const minutes = quest.time === '15 mins' ? 15 : quest.time === '30 mins' ? 30 : 60;
    scheduleQuestTimerNotification(quest.title, minutes);

    onQuestSelected();
  };

  return (
    <div className="container py-32">
      {/* Anti-Repetition Engine Nudge (Section 13) */}
      {antiRepetitionNudge && (
        <div
          className="glass-card mb-24 animate-slide-up"
          style={{
            padding: '16px 20px',
            borderColor: 'rgba(132, 204, 22, 0.4)',
            background: 'linear-gradient(135deg, rgba(132,204,22,0.1) 0%, rgba(245,158,11,0.06) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div className="flex items-center gap-12">
            <AlertCircle style={{ width: 22, height: 22, color: 'var(--accent-lime)', flexShrink: 0 }} />
            <div>
              <h4 className="font-display text-sm font-bold text-lime">Routine-Breaker Alert</h4>
              <p className="text-secondary text-xs">{antiRepetitionNudge}</p>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => handleQuickMode('wildcard')}
            style={{ padding: '6px 14px', fontSize: 11 }}
          >
            Break My Routine
          </button>
        </div>
      )}

      {/* Hero */}
      <div className="section-header text-center" style={{ maxWidth: 680, margin: '0 auto 32px' }}>
        <div className="pill pill-brand mb-16" style={{ display: 'inline-flex' }}>
          <Sparkles />
          <span>Real-World Daily Quest Generator</span>
        </div>
        <h2 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900 }}>
          Don't just get through your day.
          <br />
          <span className="text-gradient-brand">Make it different.</span>
        </h2>
        <p className="text-secondary" style={{ marginTop: 12, fontSize: 15 }}>
          Pick a signature mode or customize your 6 parameters below.
        </p>
      </div>

      {/* Signature Quick-Action Modes Bar (Sections 45-51) */}
      <div className="mb-32">
        <div className="flex items-center justify-between mb-12">
          <span className="form-label" style={{ marginBottom: 0 }}>Signature Quick Escape Modes</span>
          <span className="font-mono text-xs text-muted">1-Tap Experience Generation</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <button
            type="button"
            className="glass-card glass-card-interactive"
            onClick={() => handleQuickMode('room_escape')}
            style={{
              padding: '16px 18px',
              textAlign: 'left',
              cursor: 'pointer',
              borderColor: activeQuickMode === 'room_escape' ? 'var(--accent-lime)' : 'var(--border-glass)',
            }}
          >
            <div className="font-display font-bold text-sm text-lime mb-4">🚪 Out of Room</div>
            <div className="text-secondary text-xs">Instant 1-tap escape. You set the time, we handle the rest.</div>
          </button>

          <button
            type="button"
            className="glass-card glass-card-interactive"
            onClick={() => handleQuickMode('bored')}
            style={{
              padding: '16px 18px',
              textAlign: 'left',
              cursor: 'pointer',
              borderColor: activeQuickMode === 'bored' ? 'var(--accent-sunset)' : 'var(--border-glass)',
            }}
          >
            <div className="font-display font-bold text-sm text-sunset mb-4">🥱 I'm Bored</div>
            <div className="text-secondary text-xs">High-novelty, low-stimulation antidote to daily boredom.</div>
          </button>

          <button
            type="button"
            className="glass-card glass-card-interactive"
            onClick={() => handleQuickMode('wildcard')}
            style={{
              padding: '16px 18px',
              textAlign: 'left',
              cursor: 'pointer',
              borderColor: activeQuickMode === 'wildcard' ? 'var(--accent-cyan)' : 'var(--border-glass)',
            }}
          >
            <div className="font-display font-bold text-sm text-cyan mb-4">🎲 Wild Card</div>
            <div className="text-secondary text-xs">Total surprise. Step completely outside your comfort zone.</div>
          </button>

          <button
            type="button"
            className="glass-card glass-card-interactive"
            onClick={() => handleQuickMode('tonight')}
            style={{
              padding: '16px 18px',
              textAlign: 'left',
              cursor: 'pointer',
              borderColor: activeQuickMode === 'tonight' ? 'var(--accent-gold)' : 'var(--border-glass)',
            }}
          >
            <div className="font-display font-bold text-sm text-gold mb-4">🌆 Tonight</div>
            <div className="text-secondary text-xs">Golden-hour sunset chasing & evening calm in {city}.</div>
          </button>

          <button
            type="button"
            className="glass-card glass-card-interactive"
            onClick={() => handleQuickMode('chain')}
            style={{
              padding: '16px 18px',
              textAlign: 'left',
              cursor: 'pointer',
              borderColor: activeQuickMode === 'chain' ? 'var(--accent-violet)' : 'var(--border-glass)',
            }}
          >
            <div className="font-display font-bold text-sm text-violet mb-4">📖 Quest Chain</div>
            <div className="text-secondary text-xs">Multi-step narrative journey: "The Lost Afternoon".</div>
          </button>
        </div>
      </div>

      {/* Input Matrix */}
      <div className="glass-card mb-32" style={{ padding: 'clamp(20px, 4vw, 36px)' }}>
        <div className="ambient-glow ambient-glow-top" />

        <div className="flex items-center justify-between border-bottom" style={{ paddingBottom: 16, marginBottom: 24, position: 'relative', zIndex: 1 }}>
          <h3 className="font-display flex items-center gap-8" style={{ fontSize: 18 }}>
            <Compass style={{ color: 'var(--accent-lime)' }} />
            <span>Customize Your 6 Experience Parameters</span>
          </h3>
          <span className="font-mono text-muted text-xs">{city} • {season}</span>
        </div>

        <div className="grid-3" style={{ position: 'relative', zIndex: 1 }}>
          {/* Time */}
          <div>
            <label className="form-label"><Clock style={{ color: 'var(--accent-lime)' }} /> Time Available</label>
            <div className="chip-grid">
              {TIME_OPTIONS.map(t => (
                <button
                  key={t}
                  className={`chip ${time === t ? 'selected selected-lime' : ''}`}
                  onClick={() => {
                    triggerHaptic('light');
                    setTime(t);
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Energy */}
          <div>
            <label className="form-label"><Zap style={{ color: 'var(--accent-sunset)' }} /> Energy Level</label>
            <div className="chip-grid">
              {ENERGY_OPTIONS.map(e => (
                <button
                  key={e}
                  className={`chip ${energy === e ? 'selected selected-sunset' : ''}`}
                  onClick={() => {
                    triggerHaptic('light');
                    setEnergy(e);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Mood */}
          <div>
            <label className="form-label"><Smile style={{ color: 'var(--accent-violet)' }} /> Desired Mood</label>
            <div className="chip-grid">
              {MOOD_OPTIONS.map(m => (
                <button
                  key={m}
                  className={`chip ${mood === m ? 'selected selected-violet' : ''}`}
                  onClick={() => {
                    triggerHaptic('light');
                    setMood(m);
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="form-label"><DollarSign style={{ color: 'var(--accent-emerald)' }} /> Budget</label>
            <div className="chip-grid">
              {BUDGET_OPTIONS.map(b => (
                <button
                  key={b}
                  className={`chip ${budget === b ? 'selected selected-emerald' : ''}`}
                  onClick={() => {
                    triggerHaptic('light');
                    setBudget(b);
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Environment */}
          <div>
            <label className="form-label"><Home style={{ color: 'var(--accent-cyan)' }} /> Environment</label>
            <div className="chip-grid">
              {ENV_OPTIONS.map(env => (
                <button
                  key={env}
                  className={`chip ${environment === env ? 'selected selected-cyan' : ''}`}
                  onClick={() => {
                    triggerHaptic('light');
                    setEnvironment(env);
                  }}
                >
                  {env}
                </button>
              ))}
            </div>
          </div>

          {/* Social */}
          <div>
            <label className="form-label"><Users style={{ color: 'var(--accent-pink)' }} /> Social Preference</label>
            <div className="chip-grid">
              {SOCIAL_OPTIONS.map(s => (
                <button
                  key={s}
                  className={`chip ${social === s ? 'selected selected-pink' : ''}`}
                  onClick={() => {
                    triggerHaptic('light');
                    setSocial(s);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 28, position: 'relative', zIndex: 1 }}>
          <button className="btn btn-primary btn-lg" onClick={handleGenerate}>
            <Sparkles />
            <span>Generate My 3 Quests</span>
            <ArrowRight />
          </button>
        </div>
      </div>

      {/* 3 Quest Options */}
      <div>
        <div className="flex items-center justify-between mb-24">
          <h3 className="font-display flex items-center gap-12" style={{ fontSize: 24, fontWeight: 800 }}>
            Your 3 Quest Options
            <span className="pill pill-brand font-mono">Pick 1</span>
          </h3>
          <button className="btn-ghost text-xs" onClick={handleGenerate} style={{ textDecoration: 'underline' }}>
            Shuffle
          </button>
        </div>

        <div className="grid-3">
          {generatedOptions.map((q, idx) => (
            <div key={q.id} className="glass-card glass-card-interactive" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Index + meta */}
              <div className="flex items-center justify-between">
                <span className="quest-index">0{idx + 1}</span>
                <span className="text-xs text-secondary font-mono" style={{ padding: '4px 10px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-full)' }}>
                  {q.time} • {q.budget}
                </span>
              </div>

              {/* Title & Description */}
              <div>
                <h4 className="font-display" style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{q.title}</h4>
                <p className="text-secondary text-sm" style={{ lineHeight: 1.6 }}>{q.description}</p>
              </div>

              {/* "Why this quest?" Contextual Intelligence Badge (Section 1) */}
              <div
                style={{
                  background: 'rgba(132, 204, 22, 0.08)',
                  border: '1px solid rgba(132, 204, 22, 0.2)',
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontSize: 12,
                  color: 'var(--text-brand)',
                }}
              >
                <strong style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-lime)', marginBottom: 2 }}>
                  💡 Why this quest?
                </strong>
                <span>
                  {q.whyThisQuest || `Tailored for ${city} during ${season}. Balances ${q.mood.toLowerCase()} mood with mindful real-world immersion.`}
                </span>
              </div>

              {/* Multi-step Quest Chain Indicator */}
              {q.isQuestChain && q.chainSteps && (
                <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: '10px 14px', fontSize: 12 }}>
                  <span className="text-violet font-bold font-mono text-xs block mb-4">📖 Quest Chain: {q.chainSteps.length} Steps</span>
                  <div className="flex flex-col gap-4 text-xs text-secondary">
                    {q.chainSteps.slice(0, 3).map(s => (
                      <div key={s.stepNumber} className="flex items-center gap-6">
                        <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent-violet)', color: '#fff', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {s.stepNumber}
                        </span>
                        <span>{s.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags & Action */}
              <div className="border-top pt-16" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 12 }}>
                <div className="flex flex-wrap gap-8">
                  <span className="pill" style={{ background: 'rgba(244,63,94,0.08)', borderColor: 'rgba(244,63,94,0.2)', color: '#FCA5A5', fontSize: 10 }}>{q.mood}</span>
                  <span className="pill" style={{ background: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.2)', color: '#C4B5FD', fontSize: 10 }}>{q.social}</span>
                  <span className="pill" style={{ background: 'rgba(6,182,212,0.08)', borderColor: 'rgba(6,182,212,0.2)', color: '#67E8F9', fontSize: 10 }}>{q.environment}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-8" style={{ paddingTop: 8 }}>
                  <button
                    className="btn btn-primary flex-1"
                    onClick={() => handleAccept(q)}
                    style={{ fontSize: 12, padding: '12px 16px' }}
                  >
                    <Sparkles style={{ width: 14, height: 14 }} />
                    <span>Accept Quest</span>
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => {
                      triggerHaptic('light');
                      setCoQuestModalQuest(q);
                    }}
                    title="Share with friend"
                  >
                    <Share2 style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
