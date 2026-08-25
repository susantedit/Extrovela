/**
 * EXTROVELA — Phase 11: Personalization Settings
 *
 * The user-facing half of the personalization contract. Everything the system
 * has inferred is shown here in plain language, and every inference is
 * correctable or deletable by the person it describes.
 *
 * Four capabilities, all of which write through the real services:
 *   1. VIEW    — every learned preference, with its evidence count, confidence,
 *                and whether it came from behaviour or from something the user
 *                said explicitly.
 *   2. CORRECT — flip a preference's direction. A correction is recorded as
 *                `source: 'userExplicit'` with confidence 1, which outranks any
 *                amount of inferred behaviour from then on.
 *   3. DELETE  — remove one learned preference, or all of them.
 *   4. DISABLE — turn personalization off entirely. Nothing derived is written
 *                or read while it is off.
 *
 * There is no "are you sure you want to lose your personalization?" friction on
 * the off switch. Making the kill switch harder to reach than the on switch
 * would be a dark pattern, and the whole point of this screen is that the user
 * is in charge of what the system believes about them.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Brain,
  Info,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { Badge, Button, Card, Heading, Input, SectionHeader, Text } from '../../components/primitives';
import { haptics } from '../../utils/haptics';
import {
  DEFAULT_PERSONALIZATION_SETTINGS,
  PersonalizationSettings,
  PreferenceDimension,
} from '../../types/experienceIntelligence';
import { personalizationSettingsService } from '../../services/intelligence/personalizationSettingsService';
import { preferenceSignalService } from '../../services/intelligence/preferenceSignalService';
import { experienceRecallService } from '../../services/intelligence/experienceRecallService';
import { experienceIntelligenceService } from '../../services/intelligence/experienceIntelligenceService';
import { userPreferenceParser } from '../../services/intelligence/userPreferenceParser';
import { analytics } from '../../services/firebase/firebaseAnalytics';
import logger from '../../utils/logger';

type LearnedRow = Awaited<ReturnType<typeof experienceRecallService.getLearnedSummary>>[number];

interface PersonalizationSettingsScreenProps {
  userId: string;
  onClose?: () => void;
}

/** Turns a raw confidence into words. A bare "0.62" means nothing to a user. */
function confidenceLabel(confidence: number): string {
  if (confidence >= 0.75) return 'Strong evidence';
  if (confidence >= 0.5) return 'Some evidence';
  return 'Early guess';
}

function dimensionLabel(dimension: string): string {
  const labels: Record<string, string> = {
    experienceType: 'Kind of experience',
    category: 'Category',
    socialMode: 'Who you go with',
    environment: 'Environment',
    duration: 'How long',
    budget: 'Budget',
    timeOfDay: 'Time of day',
    distance: 'How far',
    indoorOutdoor: 'Indoor or outdoor',
    novelty: 'Familiar or new',
    pace: 'Pace',
    setting: 'Setting',
    weatherPreference: 'Weather',
  };
  return labels[dimension] || dimension;
}

export const PersonalizationSettingsScreen: React.FC<PersonalizationSettingsScreenProps> = ({
  userId,
  onClose,
}) => {
  const [settings, setSettings] = useState<PersonalizationSettings>({
    userId,
    ...DEFAULT_PERSONALIZATION_SETTINGS,
    updatedAt: new Date().toISOString(),
  });
  const [learned, setLearned] = useState<LearnedRow[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [profileVersion, setProfileVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const [preferenceText, setPreferenceText] = useState('');
  const [confirmingReset, setConfirmingReset] = useState(false);

  const load = useCallback(async () => {
    try {
      const report = await experienceIntelligenceService.getTransparencyReport(userId);
      setSettings(report.settings);
      setLearned(report.learned);
      setEventCount(report.eventCount);
      setProfileVersion(report.profileVersion);
    } catch (err) {
      logger.warn('Could not load personalization transparency report', { error: String(err) });
      setNotice({ tone: 'warn', text: 'Could not load your personalization data. Pull to retry.' });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    analytics.trackEvent('learned_preferences_viewed', { sample_count: 0 });
  }, [load]);

  const flash = (tone: 'ok' | 'warn', text: string) => {
    setNotice({ tone, text });
    setTimeout(() => setNotice(null), 2600);
  };

  const patchSettings = async (patch: Partial<Omit<PersonalizationSettings, 'userId' | 'updatedAt'>>) => {
    haptics.selection();
    // Optimistic: the switch should feel instant even on a slow write.
    setSettings(prev => ({ ...prev, ...patch, updatedAt: new Date().toISOString() }));
    try {
      const saved = await personalizationSettingsService.updateSettings(userId, patch);
      setSettings(saved);

      if (typeof patch.aiPersonalizationEnabled === 'boolean') {
        analytics.trackEvent(
          patch.aiPersonalizationEnabled ? 'personalization_enabled' : 'personalization_disabled',
          { personalization_enabled: patch.aiPersonalizationEnabled }
        );
      }
    } catch (err) {
      logger.warn('Failed to save personalization settings', { error: String(err) });
      flash('warn', 'That change did not save. Please try again.');
      void load();
    }
  };

  const handleCorrect = async (row: LearnedRow, direction: 1 | -1) => {
    setBusy(row.id);
    haptics.medium();
    try {
      const result = await preferenceSignalService.correctSignal(
        userId,
        row.dimension as PreferenceDimension,
        row.value,
        direction
      );
      if (!result) {
        flash('warn', 'That preference could not be changed.');
        return;
      }
      analytics.trackEvent('preference_corrected_by_user', {
        dimension: row.dimension,
        strength: direction,
      });
      await load();
      flash('ok', direction > 0 ? 'Noted — more like this.' : 'Noted — less like this.');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (row: LearnedRow) => {
    setBusy(row.id);
    haptics.medium();
    try {
      await preferenceSignalService.deleteSignal(userId, row.id);
      analytics.trackEvent('preference_deleted_by_user', { dimension: row.dimension });
      setLearned(prev => prev.filter(r => r.id !== row.id));
      flash('ok', 'Forgotten.');
    } finally {
      setBusy(null);
    }
  };

  const handleResetAll = async () => {
    setBusy('reset');
    haptics.warning();
    try {
      const result = await personalizationSettingsService.resetPersonalization(userId);
      analytics.trackEvent('personalization_reset', { sample_count: result.deleted });
      setConfirmingReset(false);
      await load();
      flash(
        'ok',
        `Cleared ${result.deleted} learned ${result.deleted === 1 ? 'item' : 'items'}. Your memories and history are untouched.`
      );
    } finally {
      setBusy(null);
    }
  };

  const handleSubmitPreference = async () => {
    const text = preferenceText.trim();
    if (!text) return;

    setBusy('parse');
    try {
      const { applied, rejected, unrecognized } = await userPreferenceParser.applyPreferenceText(
        userId,
        text
      );

      analytics.trackEvent('explicit_preference_submitted', { sample_count: applied.length });

      if (rejected.length > 0 && applied.length > 0) {
        // Mixed: save what we can, but be explicit that a sensitive fragment was dropped.
        flash(
          'warn',
          `Saved ${applied.length}. Some details were left out — EXTROVELA does not record health, beliefs, or other sensitive information.`
        );
        setPreferenceText('');
      } else if (rejected.length > 0) {
        // Deliberately specific: the user should know WHY it was declined rather
        // than assume the feature is broken.
        flash(
          'warn',
          'That was not saved. EXTROVELA does not record health, beliefs, or other sensitive details — only what kind of experiences you enjoy.'
        );
      } else if (applied.length > 0) {
        flash('ok', `Saved ${applied.length} ${applied.length === 1 ? 'preference' : 'preferences'}.`);
        setPreferenceText('');
      } else {
        void unrecognized;
        flash('warn', 'Could not tell what to change from that. Try "I prefer quiet outdoor places".');
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  /**
   * Toggles one of the boolean sub-settings. Written as an indexed assignment on
   * a typed Partial rather than an object literal with a computed key, because a
   * `{ [unionKey]: boolean }` literal widens to a string index signature that will
   * not assign to PersonalizationSettings (noveltyPreference is a number).
   */
  const toggleBool = (
    key: 'experienceMemoryEnabled' | 'memoryRecallEnabled' | 'surpriseQuestsEnabled'
  ) => {
    const patch: Partial<PersonalizationSettings> = {};
    patch[key] = !settings[key];
    void patchSettings(patch);
  };

  const personalizationOff = !settings.aiPersonalizationEnabled;

  return (
    <div className="container py-32" style={{ maxWidth: 720 }}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between mb-24"
        style={{ flexWrap: 'wrap', gap: 12 }}
      >
        <div className="flex items-center gap-12">
          <Brain size={22} style={{ color: 'var(--color-accent)' }} aria-hidden="true" />
          <div>
            <Badge variant="brand" mono>PERSONALIZATION</Badge>
            <Heading variant="headingLG" style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>
              What EXTROVELA has learned
            </Heading>
          </div>
        </div>
        {onClose && (
          <Button variant="glass" size="sm" onClick={onClose} aria-label="Close personalization settings">
            <X size={16} />
          </Button>
        )}
      </div>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: 12,
            borderRadius: 12,
            marginBottom: 16,
            fontSize: 13,
            background: notice.tone === 'ok' ? 'rgba(132, 204, 22, 0.14)' : 'rgba(201, 154, 69, 0.14)',
            border: `1px solid ${notice.tone === 'ok' ? '#84CC16' : '#C99A45'}`,
            color: notice.tone === 'ok' ? '#84CC16' : '#C99A45',
          }}
        >
          {notice.text}
        </div>
      )}

      {/* ── Master control ── */}
      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div className="flex items-center justify-between" style={{ gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              Personalize my experiences
            </div>
            <Text variant="bodySM" color="secondary" style={{ fontSize: 12 }}>
              When this is off, nothing new is learned about you and nothing already learned is
              used. You will still get quests — they just will not be tailored.
            </Text>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <span className="sr-only">Personalize my experiences</span>
            <input
              type="checkbox"
              checked={settings.aiPersonalizationEnabled}
              onChange={() => patchSettings({ aiPersonalizationEnabled: !settings.aiPersonalizationEnabled })}
              style={{ width: 22, height: 22, accentColor: '#C99A45', cursor: 'pointer' }}
            />
          </label>
        </div>
      </Card>

      {/* ── Sub-controls (disabled while the master switch is off) ── */}
      <Card style={{ padding: 20, marginBottom: 20, opacity: personalizationOff ? 0.45 : 1 }}>
        <SectionHeader title="What it is allowed to do" subtitle="Each of these is separate" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(
            [
              {
                key: 'experienceMemoryEnabled' as const,
                label: 'Remember my preferences long-term',
                hint: 'Keeps short factual notes like "prefers evening walks".',
              },
              {
                key: 'memoryRecallEnabled' as const,
                label: 'Explain why a quest was chosen',
                hint: 'Shows lines like "because you have enjoyed quiet places".',
              },
              {
                key: 'surpriseQuestsEnabled' as const,
                label: 'Occasionally suggest something unexpected',
                hint: 'At most once a week, and never something you have rejected.',
              },
            ]
          ).map(item => (
            <div
              key={item.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
                padding: '12px 0',
                borderBottom: '1px solid var(--color-border, rgba(246,241,231,0.08))',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                <Text variant="bodySM" color="muted" style={{ fontSize: 12 }}>
                  {item.hint}
                </Text>
              </div>
              <input
                type="checkbox"
                aria-label={item.label}
                disabled={personalizationOff}
                checked={Boolean(settings[item.key])}
                onChange={() => toggleBool(item.key)}
                style={{ width: 18, height: 18, accentColor: '#C99A45', cursor: 'pointer', marginTop: 2 }}
              />
            </div>
          ))}
        </div>

        {/* Novelty appetite */}
        <div style={{ marginTop: 16 }}>
          <div className="flex items-center justify-between mb-8">
            <span style={{ fontSize: 14, fontWeight: 600 }}>How adventurous should suggestions be?</span>
            <span className="font-mono text-xs text-accent font-bold">
              {Math.round(settings.noveltyPreference * 100)}% stretch
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            disabled={personalizationOff}
            value={Math.round(settings.noveltyPreference * 100)}
            aria-label="How adventurous should suggestions be"
            onChange={e => patchSettings({ noveltyPreference: Number(e.target.value) / 100 })}
            style={{ width: '100%', accentColor: '#C99A45', cursor: 'pointer' }}
          />
          <div className="flex justify-between text-xs text-muted font-mono mt-4">
            <span>Familiar</span>
            <span>Surprise me</span>
          </div>
        </div>
      </Card>

      {/* ── Tell it directly ── */}
      <Card style={{ padding: 20, marginBottom: 20 }}>
        <SectionHeader
          title="Tell it directly"
          subtitle="What you say here outranks anything it guessed from your behaviour"
        />
        <Input
          value={preferenceText}
          placeholder='e.g. "I prefer quiet outdoor places, never anything crowded"'
          aria-label="Describe your preferences"
          onChange={e => setPreferenceText(e.target.value)}
        />
        <div className="flex items-center justify-between mt-12" style={{ gap: 12 }}>
          <Text variant="bodySM" color="muted" style={{ fontSize: 11, flex: 1 }}>
            Read on your device only. Nothing is sent anywhere to interpret it.
          </Text>
          <Button
            variant="primary"
            size="sm"
            disabled={!preferenceText.trim() || busy === 'parse'}
            onClick={handleSubmitPreference}
          >
            {busy === 'parse' ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Card>

      {/* ── Learned preferences ── */}
      <Card style={{ padding: 20, marginBottom: 20 }}>
        <SectionHeader
          title="Learned preferences"
          subtitle={
            loading
              ? 'Loading…'
              : `${learned.length} ${learned.length === 1 ? 'preference' : 'preferences'} from ${eventCount} recorded ${eventCount === 1 ? 'action' : 'actions'}`
          }
        />

        {!loading && learned.length === 0 && (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <Sparkles size={20} style={{ color: 'var(--color-accent)', marginBottom: 8 }} aria-hidden="true" />
            <Text variant="bodySM" color="secondary" style={{ fontSize: 13 }}>
              Nothing learned yet. Complete a few experiences and this fills in — or use the box
              above to say what you like outright.
            </Text>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {learned.map(row => (
            <div
              key={row.id}
              style={{
                padding: 14,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.035)',
                opacity: busy === row.id ? 0.5 : 1,
              }}
            >
              <div className="flex items-center justify-between" style={{ gap: 12, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{row.statement}</div>
                  <Text variant="bodySM" color="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {dimensionLabel(row.dimension)} · {confidenceLabel(row.confidence)} ·{' '}
                    {row.evidenceCount} {row.evidenceCount === 1 ? 'observation' : 'observations'}
                  </Text>
                </div>
                {row.userCorrected ? (
                  <Badge variant="accent" mono>YOU SET THIS</Badge>
                ) : (
                  <Badge variant="brand" mono>INFERRED</Badge>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Button
                  variant={row.direction === 'likes' ? 'primary' : 'glass'}
                  size="sm"
                  disabled={busy === row.id}
                  onClick={() => handleCorrect(row, 1)}
                  leftIcon={<ThumbsUp size={13} />}
                  aria-label={`Mark ${row.value} as something you like`}
                >
                  More
                </Button>
                <Button
                  variant={row.direction === 'avoids' ? 'primary' : 'glass'}
                  size="sm"
                  disabled={busy === row.id}
                  onClick={() => handleCorrect(row, -1)}
                  leftIcon={<ThumbsDown size={13} />}
                  aria-label={`Mark ${row.value} as something you avoid`}
                >
                  Less
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy === row.id}
                  onClick={() => handleDelete(row)}
                  leftIcon={<Trash2 size={13} />}
                  aria-label={`Forget that you ${row.direction} ${row.value}`}
                  style={{ marginLeft: 'auto' }}
                >
                  Forget
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Reset ── */}
      <Card style={{ padding: 20, marginBottom: 20 }}>
        <SectionHeader
          title="Start over"
          subtitle="Clears everything learned. Your memories, photos, and history stay."
        />
        {confirmingReset ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" size="sm" onClick={() => setConfirmingReset(false)} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={busy === 'reset'}
              onClick={handleResetAll}
              leftIcon={<RefreshCw size={13} />}
              style={{ flex: 2 }}
            >
              {busy === 'reset' ? 'Clearing…' : 'Yes, forget everything learned'}
            </Button>
          </div>
        ) : (
          <Button
            variant="glass"
            size="sm"
            onClick={() => {
              haptics.selection();
              setConfirmingReset(true);
            }}
            leftIcon={<RefreshCw size={14} />}
          >
            Reset personalization
          </Button>
        )}
      </Card>

      {/* ── What is never collected ── */}
      <Card style={{ padding: 20 }}>
        <div className="flex items-center gap-8 mb-12">
          <ShieldCheck size={18} style={{ color: '#84CC16' }} aria-hidden="true" />
          <span style={{ fontSize: 14, fontWeight: 700 }}>What is never recorded</span>
        </div>
        <Text variant="bodySM" color="secondary" style={{ fontSize: 12, marginBottom: 10 }}>
          EXTROVELA records what kinds of experiences you enjoy. It does not infer or store
          health or mental-health information, beliefs, politics, sexual orientation, race or
          ethnicity, criminal history, or your finances beyond the budget you pick for a quest.
        </Text>
        <Text variant="bodySM" color="secondary" style={{ fontSize: 12, marginBottom: 10 }}>
          Your written reflections stay yours. They are never shared with friends, published, or
          sent to analytics. When a reflection informs a preference, only a measurement of it is
          kept — never the words.
        </Text>
        <div className="flex items-center gap-8" style={{ marginTop: 12 }}>
          <Info size={13} style={{ color: 'var(--color-text-muted, rgba(246,241,231,0.5))' }} aria-hidden="true" />
          <Text variant="bodySM" color="muted" style={{ fontSize: 11 }}>
            {profileVersion === null
              ? 'No profile has been built yet.'
              : `Profile version ${profileVersion} · rebuilt from ${eventCount} recorded ${eventCount === 1 ? 'action' : 'actions'}`}
          </Text>
        </div>
      </Card>

      {/* Screen-reader-only helper, matching the app's existing utility class set. */}
      <style>{`
        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }
      `}</style>
    </div>
  );
};

export default PersonalizationSettingsScreen;

/** Small helper so callers can show a "learned N things" affordance without loading the screen. */
export async function getLearnedCount(userId: string): Promise<number> {
  try {
    const rows = await experienceRecallService.getLearnedSummary(userId);
    return rows.length;
  } catch {
    return 0;
  }
}
