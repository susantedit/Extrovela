import React, { useState } from 'react';
import { BarChart3, Heart, MapPin, Calendar as CalendarIcon, Flame, Star, Compass, Award, Share2 } from 'lucide-react';
import { useAppState } from '../context/AppStateContext';
import { ShareStoryModal } from './ShareStoryModal';
import { triggerHaptic } from '../lib/native-device';

export const RecapsView: React.FC = () => {
  const { memories, stats } = useAppState();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Calculate insights
  const totalQuests = stats.totalQuestsCompleted;
  const longestStreak = stats.routineBreakerStreak;
  const firstTimeCount = memories.filter(m => m.isFirstTimeExperience).length;
  const avgMood = memories.length > 0
    ? (memories.reduce((sum, m) => sum + m.moodRating, 0) / memories.length).toFixed(1)
    : '—';

  const topMoods = memories.reduce<Record<string, number>>((acc, m) => {
    const tag = m.tags[0] || 'general';
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {});

  const topCategory = Object.entries(topMoods).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None yet';

  return (
    <div className="container py-32">
      {/* Header */}
      <div className="section-header text-center" style={{ maxWidth: 560, margin: '0 auto 40px' }}>
        <h2 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 900 }}>
          Your Life in <span className="text-gradient-brand">Experiences</span>
        </h2>
        <p className="text-secondary" style={{ fontSize: 15, marginTop: 8 }}>
          Every quest completed reveals more of who you can become.
        </p>
      </div>

      {/* Stat Grid */}
      <div className="grid-4 mb-32">
        {[
          { icon: Compass, label: 'Total Quests', value: totalQuests, color: 'var(--accent-lime)' },
          { icon: Star, label: 'Avg. Mood', value: avgMood, color: 'var(--accent-gold)' },
          { icon: Flame, label: 'Streak Days', value: longestStreak, color: 'var(--accent-sunset)' },
          { icon: Heart, label: 'First-Times', value: firstTimeCount, color: 'var(--accent-pink)' },
        ].map((s, i) => {
          const SIcon = s.icon;
          return (
            <div key={i} className="stat-card animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
              <SIcon style={{ width: 20, height: 20, color: s.color, marginBottom: 12 }} />
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Recap Card */}
      <div className="glass-card recap-card text-center mb-32">
        <div className="ambient-glow ambient-glow-bottom" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Award style={{ width: 48, height: 48, margin: '0 auto 20px', color: 'var(--accent-lime)' }} />
          <h3 className="font-display mb-12" style={{ fontSize: 'clamp(20px, 3.5vw, 30px)', fontWeight: 800 }}>
            Your Identity Pattern
          </h3>

          {memories.length > 0 ? (
            <>
              <p className="text-secondary" style={{ fontSize: 15, lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>
                You've explored{' '}
                <strong className="text-lime">{memories.length} unique experience{memories.length === 1 ? '' : 's'}</strong>{' '}
                across{' '}
                <strong className="text-sunset">{stats.uniqueLocationsVisited} location{stats.uniqueLocationsVisited === 1 ? '' : 's'}</strong>.
                Your top category is{' '}
                <strong className="text-violet" style={{ textTransform: 'capitalize' }}>{topCategory}</strong>.
                Every quest shapes your story.
              </p>

              <div className="grid-2 mt-24 mb-24" style={{ maxWidth: 400, margin: '24px auto 24px' }}>
                <div className="info-box info-box-brand text-center">
                  <MapPin style={{ width: 16, height: 16, margin: '0 auto 6px', color: 'var(--accent-lime)' }} />
                  <h4 className="font-display text-brand">{stats.uniqueLocationsVisited}</h4>
                  <span className="text-xs text-muted">Unique Locations</span>
                </div>
                <div className="info-box info-box-brand text-center">
                  <CalendarIcon style={{ width: 16, height: 16, margin: '0 auto 6px', color: 'var(--accent-lime)' }} />
                  <h4 className="font-display text-brand">{stats.cityExplorationPercent}%</h4>
                  <span className="text-xs text-muted">City Explored</span>
                </div>
              </div>

              {/* Share 9:16 Social Story Button */}
              <button
                className="btn btn-primary btn-lg"
                onClick={() => {
                  triggerHaptic('success');
                  setIsShareModalOpen(true);
                }}
              >
                <Share2 style={{ width: 16, height: 16 }} />
                <span>Share Monthly 9:16 Story</span>
              </button>
            </>
          ) : (
            <p className="text-secondary" style={{ fontSize: 15, maxWidth: 400, margin: '0 auto' }}>
              Complete your first quest and your recap will appear here.
              <br />
              <strong className="text-lime">Go discover something new today.</strong>
            </p>
          )}
        </div>
      </div>

      {/* Recent Timeline */}
      {memories.length > 0 && (
        <div className="mt-24">
          <h3 className="font-display mb-16" style={{ fontSize: 20, fontWeight: 800 }}>Recent Timeline</h3>
          <div className="flex flex-col gap-12">
            {memories.slice(-5).reverse().map(m => (
              <div key={m.id} className="glass-card flex items-center gap-16" style={{ padding: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border-glass)' }}>
                  <img src={m.photoUrl || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 className="font-display text-sm font-bold" style={{ marginBottom: 2 }}>{m.questTitle}</h4>
                  <p className="text-xs text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.location.placeName || m.location.city} — "{m.reflectionText}"
                  </p>
                </div>
                <div className="flex items-center gap-8 shrink-0">
                  {[...Array(m.moodRating)].map((_, i) => (
                    <Star key={i} style={{ width: 12, height: 12, fill: 'var(--accent-gold)', color: 'var(--accent-gold)' }} />
                  ))}
                </div>
                <span className="font-mono text-xs text-muted shrink-0">
                  {new Date(m.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9:16 Recap Share Modal */}
      <ShareStoryModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        stats={stats}
        mode="recap"
      />
    </div>
  );
};
