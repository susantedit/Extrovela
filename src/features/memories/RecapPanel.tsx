/**
 * EXTROVELA — Recap Panel + Story Mode (Phase 12)
 *
 * Mounts the REAL recapGenerationService into the Memories tab. Everything on
 * open is factual and computed on-device (no network, no LLM): stats, real
 * places, real firsts, real highlights. The optional AI narrative is fetched
 * ONLY when the user taps "Generate story", is feature-gated + double-grounded by
 * the service, and degrades to an honest "narrative unavailable" state — never a
 * fabricated story. Story Mode slides are built by the pure buildRecapStorySlides.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Memory } from '../../types/memory';
import { ExperienceRecap, RecapPeriodType } from '../../types/recap';
import { recapGenerationService } from '../../services/memories/recapGenerationService';
import { buildRecapStorySlides, RecapStorySlide } from '../../services/memories/recapStorySlides';
import { analytics } from '../../services/firebase/firebaseAnalytics';
import { toCountBucket } from '../../types/analytics';
import { Heading, Text } from '../../components/primitives/Typography';
import { Button } from '../../components/primitives/Button';
import { haptics } from '../../utils/haptics';

const ACCENT: Record<RecapStorySlide['accent'], string> = {
  lime: '#84CC16',
  gold: '#C99A45',
  cream: '#F6F1E7',
};

const PERIODS: { key: RecapPeriodType; label: string }[] = [
  { key: 'weekly', label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
  { key: 'yearly', label: 'This Year' },
];

type NarrativeState = 'idle' | 'loading' | 'unavailable' | 'ready';

interface RecapPanelProps {
  memories: Memory[];
  userId: string | null;
}

export const RecapPanel: React.FC<RecapPanelProps> = ({ memories, userId }) => {
  const [period, setPeriod] = useState<RecapPeriodType>('monthly');
  const [narrative, setNarrative] = useState<{ text: string; title: string | null } | null>(null);
  const [narrativeState, setNarrativeState] = useState<NarrativeState>('idle');
  const [storyOpen, setStoryOpen] = useState(false);

  // Pure, on-device recap for the current period. Recomputed only when its
  // inputs change; opening this panel never calls a model.
  const recapBase = useMemo(
    () =>
      recapGenerationService.computeRecap({
        userId: userId || 'anonymous',
        periodType: period,
        refIso: new Date().toISOString(),
        memories,
      }),
    [memories, period, userId]
  );

  const recap: ExperienceRecap = useMemo(() => {
    if (narrative && narrativeState === 'ready') {
      return { ...recapBase, narrative: narrative.text, narrativeTitle: narrative.title, narrativeAvailable: true };
    }
    return recapBase;
  }, [recapBase, narrative, narrativeState]);

  const slides = useMemo(() => buildRecapStorySlides(recap), [recap]);

  // A narrative belongs to one specific period; switching period discards it.
  useEffect(() => {
    setNarrative(null);
    setNarrativeState('idle');
    analytics.trackEvent('recap_viewed', {
      recap_period: period,
      memory_count_bucket: toCountBucket(recapBase.stats.totalExperiences),
      narrative_available: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const generateStory = async () => {
    if (!userId || narrativeState === 'loading') return;
    haptics.light();
    setNarrativeState('loading');
    analytics.trackEvent('recap_generation_started', { recap_period: period });
    try {
      const enriched = await recapGenerationService.attachNarrative(recapBase, userId);
      if (enriched.narrativeAvailable && enriched.narrative) {
        setNarrative({ text: enriched.narrative, title: enriched.narrativeTitle });
        setNarrativeState('ready');
        analytics.trackEvent('recap_generation_succeeded', { recap_period: period, narrative_available: true });
        void recapGenerationService.save(enriched).catch(() => {});
      } else {
        setNarrativeState('unavailable');
        analytics.trackEvent('recap_narrative_unavailable', { recap_period: period });
      }
    } catch {
      setNarrativeState('unavailable');
      analytics.trackEvent('recap_generation_failed', { recap_period: period });
    }
  };

  const openStory = () => {
    haptics.medium();
    analytics.trackEvent('recap_story_mode_opened', { recap_period: period, slide_count: slides.length });
    setStoryOpen(true);
  };

  const s = recap.stats;
  const statCells: { label: string; value: string | number; color: string }[] = [
    { label: 'EXPERIENCES', value: s.totalExperiences, color: '#84CC16' },
    { label: 'NEW PLACES', value: s.newPlaces, color: '#C99A45' },
    { label: 'FIRST-TIMES', value: s.firstTimes, color: '#3B82F6' },
    { label: 'FAVORITES', value: s.favoriteCount, color: '#F59E0B' },
    { label: 'SOLO / SHARED', value: `${s.soloCount} / ${s.socialCount}`, color: '#F6F1E7' },
    { label: 'OUT / INDOORS', value: `${s.outdoorCount} / ${s.indoorCount}`, color: '#F6F1E7' },
    { label: 'CATEGORIES', value: s.distinctCategories, color: '#F6F1E7' },
    { label: 'AVG RATING', value: s.averageRating > 0 ? s.averageRating.toFixed(1) : '—', color: '#C99A45' },
  ];

  return (
    <div style={{ marginBottom: 36 }}>
      {/* Period switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => {
              haptics.selection();
              setPeriod(p.key);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: '1px solid var(--color-border)',
              backgroundColor: period === p.key ? 'var(--color-accent)' : 'var(--color-surface)',
              color: period === p.key ? '#000' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Text variant="caption" style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 16 }}>
        {recap.periodLabel}
      </Text>

      {s.totalExperiences === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 20px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 16,
            border: '1px dashed var(--color-border)',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>🗓️</div>
          <Heading variant="headingMD" style={{ marginBottom: 8 }}>
            Nothing logged in this period.
          </Heading>
          <Text variant="bodySM" color="secondary">
            Recaps are built only from real experiences — there's nothing to invent here yet.
          </Text>
        </div>
      ) : (
        <>
          {/* Verified stat grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 12,
              marginBottom: 20,
              backgroundColor: 'rgba(32, 33, 27, 0.6)',
              border: '1px solid var(--color-border)',
              borderRadius: 14,
              padding: '16px 20px',
            }}
          >
            {statCells.map(cell => (
              <div key={cell.label}>
                <Text variant="caption" style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>
                  {cell.label}
                </Text>
                <div style={{ fontSize: 22, fontWeight: 700, color: cell.color, fontFamily: 'serif' }}>{cell.value}</div>
              </div>
            ))}
          </div>

          {/* Highlights */}
          {recap.highlights.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Text variant="label" style={{ color: '#C99A45', display: 'block', marginBottom: 8, fontSize: 11, letterSpacing: '0.1em' }}>
                HIGHLIGHTS
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recap.highlights.slice(0, 5).map(h => (
                  <div
                    key={h.memoryId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                    }}
                  >
                    <span style={{ fontSize: 14, color: 'var(--color-text)' }}>
                      {h.isFavorite ? '★ ' : h.isFirstTime ? '✨ ' : ''}
                      {h.title}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                      {new Date(h.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={openStory} style={{ flex: 1, minWidth: 160 }}>
              ▶ Story Mode
            </Button>
          </div>
        </>
      )}

      {storyOpen && (
        <RecapStoryMode
          slides={slides}
          period={period}
          canGenerate={!!userId}
          narrativeState={narrativeState}
          hasNarrative={recap.narrativeAvailable}
          onGenerate={generateStory}
          onClose={() => setStoryOpen(false)}
        />
      )}
    </div>
  );
};

// ─── Story Mode overlay ──────────────────────────────────────────
interface StoryModeProps {
  slides: RecapStorySlide[];
  period: RecapPeriodType;
  canGenerate: boolean;
  hasNarrative: boolean;
  narrativeState: NarrativeState;
  onGenerate: () => void;
  onClose: () => void;
}

const RecapStoryMode: React.FC<StoryModeProps> = ({
  slides,
  period,
  canGenerate,
  hasNarrative,
  narrativeState,
  onGenerate,
  onClose,
}) => {
  const [index, setIndex] = useState(0);
  const current = slides[Math.min(index, slides.length - 1)];

  useEffect(() => {
    analytics.trackEvent('recap_slide_viewed', { recap_period: period, slide_index: index, slide_count: slides.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const next = () => {
    haptics.light();
    setIndex(i => Math.min(i + 1, slides.length - 1));
  };
  const prev = () => {
    haptics.light();
    setIndex(i => Math.max(i - 1, 0));
  };

  const accent = ACCENT[current.accent];
  const isLast = index >= slides.length - 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#08090D',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        color: '#F6F1E7',
      }}
    >
      {/* Progress bars */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {slides.map((sl, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i <= index ? accent : 'rgba(255,255,255,0.2)',
              transition: 'background-color 0.3s ease',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(246,241,231,0.6)', fontSize: 22, cursor: 'pointer' }}>
          ✕
        </button>
      </div>

      {/* Slide body — tap left/right thirds to navigate */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 2 }}>
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={prev} />
          <div style={{ flex: 2, cursor: 'pointer' }} onClick={next} />
        </div>

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 24px' }}>
          <div style={{ width: 60, height: 5, borderRadius: 3, backgroundColor: accent, margin: '0 auto 24px' }} />
          <Heading variant="display" style={{ fontFamily: 'serif', fontSize: 'clamp(28px, 7vw, 44px)', marginBottom: 24, color: '#F6F1E7' }}>
            {current.heading}
          </Heading>
          {current.lines.map((line, i) => (
            <Text
              key={i}
              style={{
                display: 'block',
                fontSize: current.kind === 'narrative' ? 18 : 22,
                lineHeight: 1.6,
                color: current.kind === 'narrative' ? 'rgba(246,241,231,0.85)' : accent,
                fontStyle: current.kind === 'narrative' ? 'italic' : 'normal',
                marginBottom: 10,
              }}
            >
              {line}
            </Text>
          ))}
        </div>
      </div>

      {/* Narrative CTA on the last slide — honest about availability */}
      {isLast && !hasNarrative && (
        <div style={{ position: 'relative', zIndex: 3, textAlign: 'center', paddingBottom: 8 }}>
          {narrativeState === 'unavailable' ? (
            <Text variant="bodySM" color="secondary" style={{ display: 'block', maxWidth: 320, margin: '0 auto' }}>
              A written story isn't available right now — your verified stats are shown as-is. (AI narration requires
              server configuration and is gradually rolling out.)
            </Text>
          ) : (
            <Button
              variant="glass"
              onClick={onGenerate}
              disabled={!canGenerate || narrativeState === 'loading'}
              style={{ color: '#84CC16', borderColor: 'rgba(132,204,22,0.4)' }}
            >
              {narrativeState === 'loading' ? 'Composing…' : '✎ Generate written story'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default RecapPanel;
