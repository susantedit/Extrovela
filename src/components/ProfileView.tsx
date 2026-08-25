import React from 'react';
import { Compass, Footprints, Heart, MapPin, Sparkles, Sun, Users, Flame, Award, Sliders } from 'lucide-react';
import { useAppState } from '../context/AppStateContext';
import { triggerHaptic } from '../lib/native-device';

export const ProfileView: React.FC = () => {
  const { stats, preferences, updatePreferences, memories } = useAppState();

  const handleResetOnboarding = () => {
    triggerHaptic('medium');
    updatePreferences({ hasCompletedOnboarding: false });
  };

  return (
    <div className="container py-32" style={{ maxWidth: 880 }}>
      {/* Header Profile Card */}
      <div className="glass-card mb-32" style={{ padding: 'clamp(24px, 5vw, 44px)', position: 'relative' }}>
        <div className="ambient-glow ambient-glow-top" />

        <div className="flex items-center justify-between border-bottom" style={{ paddingBottom: 20, marginBottom: 24, position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: 16 }}>
          <div className="flex items-center gap-16">
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-lime), var(--accent-gold))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 24px var(--accent-lime-glow)',
              }}
            >
              <Compass style={{ width: 34, height: 34, color: '#000' }} />
            </div>
            <div>
              <span className="pill pill-brand mb-6 font-mono text-xs">{stats.explorerArchetype}</span>
              <h2 className="font-display" style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 900 }}>
                Your World Profile
              </h2>
              <p className="text-secondary text-xs font-mono">
                {memories.length} experiences logged across your life map
              </p>
            </div>
          </div>

          <button
            className="btn btn-glass"
            onClick={handleResetOnboarding}
            style={{ fontSize: 12, padding: '8px 14px' }}
          >
            <Sliders style={{ width: 14, height: 14 }} />
            <span>Retune Personality</span>
          </button>
        </div>

        {/* Milestone Grid */}
        <div className="grid-4 mb-24" style={{ position: 'relative', zIndex: 1 }}>
          <div className="stat-card">
            <MapPin style={{ width: 20, height: 20, color: 'var(--accent-lime)', marginBottom: 8 }} />
            <div className="stat-value text-lime">{stats.uniqueLocationsVisited}</div>
            <div className="stat-label">Places Visited</div>
          </div>
          <div className="stat-card">
            <Award style={{ width: 20, height: 20, color: 'var(--accent-sunset)', marginBottom: 8 }} />
            <div className="stat-value text-sunset">{stats.firstTimeCount}</div>
            <div className="stat-label">First Times</div>
          </div>
          <div className="stat-card">
            <Heart style={{ width: 20, height: 20, color: 'var(--accent-pink)', marginBottom: 8 }} />
            <div className="stat-value text-pink">{stats.totalQuestsCompleted}</div>
            <div className="stat-label">Memories</div>
          </div>
          <div className="stat-card">
            <Flame style={{ width: 20, height: 20, color: 'var(--accent-gold)', marginBottom: 8 }} />
            <div className="stat-value text-gold">{stats.routineBreakerStreak}d</div>
            <div className="stat-label">Streak</div>
          </div>
        </div>

        {/* Behavioral Experience Ratios (Section 42) */}
        <div className="grid-2" style={{ position: 'relative', zIndex: 1, gap: 16 }}>
          {/* Outdoor vs Indoor */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-8">
              <span className="form-label" style={{ marginBottom: 0 }}>
                <Sun style={{ color: 'var(--accent-lime)' }} /> Environment Ratio
              </span>
              <span className="font-mono text-xs text-lime font-bold">{stats.outdoorPercentage}% Outdoor</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${stats.outdoorPercentage}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-lime), var(--accent-emerald))', borderRadius: 99 }} />
            </div>
            <div className="flex justify-between text-xs text-muted mt-8 font-mono">
              <span>Indoor ({100 - stats.outdoorPercentage}%)</span>
              <span>Outdoor ({stats.outdoorPercentage}%)</span>
            </div>
          </div>

          {/* Solo vs Social */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-8">
              <span className="form-label" style={{ marginBottom: 0 }}>
                <Users style={{ color: 'var(--accent-sunset)' }} /> Social Mode
              </span>
              <span className="font-mono text-xs text-sunset font-bold">{stats.soloPercentage}% Solo</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${stats.soloPercentage}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-sunset), var(--accent-violet))', borderRadius: 99 }} />
            </div>
            <div className="flex justify-between text-xs text-muted mt-8 font-mono">
              <span>Solo ({stats.soloPercentage}%)</span>
              <span>Social ({100 - stats.soloPercentage}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Goals Card */}
      <div className="glass-card" style={{ padding: 28 }}>
        <h3 className="font-display mb-16" style={{ fontSize: 18, fontWeight: 800 }}>
          Your Life Experience Objectives
        </h3>
        <div className="flex flex-wrap gap-8">
          {preferences.goals.map(goalId => (
            <span key={goalId} className="pill pill-brand font-mono" style={{ textTransform: 'capitalize' }}>
              ✓ {goalId.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
