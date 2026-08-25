import React, { useState } from 'react';
import { Compass, Sparkles, Footprints, Heart, Users, MapPin, Zap, ArrowRight, Check } from 'lucide-react';
import { useAppState } from '../context/AppStateContext';
import { triggerHaptic } from '../lib/native-device';

const GOAL_OPTIONS = [
  { id: 'break_routine', label: 'Break my daily routine', icon: Zap },
  { id: 'explore_city', label: 'Explore hidden corners of my city', icon: MapPin },
  { id: 'solo_adventures', label: 'Find mindful things to do alone', icon: Footprints },
  { id: 'more_memories', label: 'Create lasting real-world memories', icon: Heart },
  { id: 'outdoor_time', label: 'Spend more time outside the room', icon: Compass },
  { id: 'low_pressure_social', label: 'Low-pressure connection with people', icon: Users },
];

export const OnboardingModal: React.FC = () => {
  const { preferences, updatePreferences } = useAppState();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedGoals, setSelectedGoals] = useState<string[]>(['break_routine', 'outdoor_time']);
  const [adventurous, setAdventurous] = useState<number>(50);
  const [soloSocial, setSoloSocial] = useState<number>(30);
  const [spontaneous, setSpontaneous] = useState<number>(70);
  const [calmEnergetic, setCalmEnergetic] = useState<number>(40);

  if (preferences.hasCompletedOnboarding) return null;

  const toggleGoal = (id: string) => {
    triggerHaptic('light');
    setSelectedGoals(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const handleFinish = () => {
    triggerHaptic('success');
    updatePreferences({
      goals: selectedGoals,
      personality: {
        adventurousVsComfort: adventurous,
        soloVsSocial: soloSocial,
        spontaneousVsPlanned: spontaneous,
        calmVsEnergetic: calmEnergetic,
      },
      hasCompletedOnboarding: true,
    });
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-card animate-slide-up" style={{ maxWidth: 620, padding: 32 }}>
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-20 border-bottom" style={{ paddingBottom: 12 }}>
          <div className="flex items-center gap-8">
            <span className="quest-index" style={{ width: 26, height: 26, fontSize: 11 }}>0{step}</span>
            <span className="font-mono text-xs text-muted">Step {step} of 2 • Progressive Personalization</span>
          </div>
          <span className="font-mono text-xs text-lime">EXTROVELA</span>
        </div>

        {step === 1 ? (
          <div>
            <div className="mb-24">
              <div className="pill pill-brand mb-12">
                <Sparkles style={{ width: 13, height: 13 }} />
                <span>Welcome to EXTROVELA</span>
              </div>
              <h2 className="font-display" style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>
                What are you looking for?
              </h2>
              <p className="text-secondary text-sm">
                Pick what matters to you. Your daily quests will adapt to your rhythm.
              </p>
            </div>

            <div className="flex flex-col gap-10 mb-28">
              {GOAL_OPTIONS.map(goal => {
                const Icon = goal.icon;
                const isSelected = selectedGoals.includes(goal.id);
                return (
                  <button
                    key={goal.id}
                    type="button"
                    className="glass-card flex items-center justify-between"
                    onClick={() => toggleGoal(goal.id)}
                    style={{
                      padding: '14px 18px',
                      cursor: 'pointer',
                      borderColor: isSelected ? 'var(--accent-lime)' : 'var(--border-glass)',
                      background: isSelected ? 'var(--accent-lime-glow)' : 'var(--bg-glass)',
                    }}
                  >
                    <div className="flex items-center gap-12">
                      <Icon style={{ width: 18, height: 18, color: isSelected ? 'var(--accent-lime)' : 'var(--text-secondary)' }} />
                      <span className="font-bold text-sm" style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {goal.label}
                      </span>
                    </div>
                    {isSelected && (
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                        <Check style={{ width: 12, height: 12 }} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              className="btn btn-primary w-full btn-lg"
              onClick={() => {
                triggerHaptic('medium');
                setStep(2);
              }}
              style={{ justifyContent: 'center' }}
            >
              <span>Continue to Personality Rhythm</span>
              <ArrowRight style={{ width: 16, height: 16 }} />
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-24">
              <h2 className="font-display" style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>
                Your Experience Personality
              </h2>
              <p className="text-secondary text-sm">
                Fine-tune how EXTROVELA crafts your daily experience options.
              </p>
            </div>

            <div className="flex flex-col gap-20 mb-28">
              {/* Spectrum 1: Comfortable vs Adventurous */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-8">
                  <span className="text-muted">🌿 Comfortable & Cozy</span>
                  <span className="text-lime">🔥 Bold & Adventurous</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={adventurous}
                  onChange={e => setAdventurous(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-lime)' }}
                />
              </div>

              {/* Spectrum 2: Solo vs Social */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-8">
                  <span className="text-muted">🚶 Solo & Mindful</span>
                  <span className="text-sunset">👥 Low-Pressure Social</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={soloSocial}
                  onChange={e => setSoloSocial(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-sunset)' }}
                />
              </div>

              {/* Spectrum 3: Planned vs Spontaneous */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-8">
                  <span className="text-muted">📅 Structured</span>
                  <span className="text-cyan">🎲 Spontaneous Surprises</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={spontaneous}
                  onChange={e => setSpontaneous(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                />
              </div>

              {/* Spectrum 4: Calm vs Energetic */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-8">
                  <span className="text-muted">☕ Calm & Low-Stimulation</span>
                  <span className="text-gold">⚡ High Energy & Movement</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={calmEnergetic}
                  onChange={e => setCalmEnergetic(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-gold)' }}
                />
              </div>
            </div>

            <div className="flex gap-12">
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => setStep(1)}
                style={{ fontSize: 13 }}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1 btn-lg"
                onClick={handleFinish}
                style={{ justifyContent: 'center' }}
              >
                <Sparkles style={{ width: 16, height: 16 }} />
                <span>Step Into Your World</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
