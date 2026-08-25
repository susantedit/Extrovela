/**
 * EXTROVELA — Share Card Modal (Phase 12)
 *
 * The user-facing surface for turning a memory or recap into a PUBLIC, link-
 * shareable card. It is built around one principle: nothing becomes public
 * without the user seeing EXACTLY what will be published first.
 *
 *   - The "What becomes public" list is the literal payload from
 *     shareExperienceCardService.preview() — the same object that is written.
 *   - Publishing is an explicit button press, never automatic.
 *   - The published card is a NEWLY rendered composite (canvas), never the user's
 *     original private media, and the payload provably carries no userId, memoryId,
 *     coordinates, or reflection text (buildPublicSharePayload's denylist).
 *   - A published link can be revoked here; revoke stops it resolving and deletes
 *     the rendered image.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ShareableSubject, ShareSubjectType, ShareTemplate } from '../../types/share';
import { SHARE_TEMPLATES, SHARE_TEMPLATE_META } from '../../services/sharing/sharePayload';
import { shareExperienceCardService } from '../../services/sharing/shareExperienceCardService';
import { analytics } from '../../services/firebase/firebaseAnalytics';
import { Heading, Text } from '../../components/primitives/Typography';
import { Button } from '../../components/primitives/Button';
import { Card } from '../../components/primitives/Card';
import { haptics } from '../../utils/haptics';

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: ShareableSubject;
  subjectType: ShareSubjectType;
  subjectId: string;
  userId: string | null;
}

type PublishState = 'idle' | 'publishing' | 'published' | 'error';

const EXPIRY_OPTIONS: { label: string; days?: number }[] = [
  { label: 'No expiry' },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
];

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  isOpen,
  onClose,
  subject,
  subjectType,
  subjectId,
  userId,
}) => {
  const [template, setTemplate] = useState<ShareTemplate>(subjectType === 'recap' ? 'recap' : 'editorial');
  const [state, setState] = useState<PublishState>('idle');
  const [result, setResult] = useState<{ token: string; webUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiryIdx, setExpiryIdx] = useState(0);

  useEffect(() => {
    if (isOpen) {
      analytics.trackEvent('share_card_previewed', { share_template: template });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // The exact payload that would be published for the chosen template.
  const preview = useMemo(() => shareExperienceCardService.preview(subject, template), [subject, template]);

  if (!isOpen) return null;

  const changeTemplate = (t: ShareTemplate) => {
    haptics.selection();
    setTemplate(t);
    analytics.trackEvent('share_card_template_changed', { share_template: t });
  };

  const publish = async () => {
    if (!userId || state === 'publishing') return;
    haptics.medium();
    setState('publishing');
    try {
      const res = await shareExperienceCardService.publish({
        userId,
        subject,
        template,
        subjectType,
        subjectId,
        expiresInDays: EXPIRY_OPTIONS[expiryIdx].days,
      });
      setResult({ token: res.token, webUrl: res.webUrl });
      setState('published');
      analytics.trackEvent('share_card_created', { share_template: template });
    } catch {
      setState('error');
    }
  };

  const revoke = async () => {
    if (!userId || !result) return;
    haptics.medium();
    await shareExperienceCardService.revoke(userId, result.token).catch(() => {});
    analytics.trackEvent('share_card_revoked', { share_template: template });
    setResult(null);
    setState('idle');
  };

  const copyLink = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.webUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const publicFields: { label: string; value?: string | string[] }[] = [
    { label: 'Title', value: preview.title },
    { label: 'Subtitle', value: preview.subtitle },
    { label: 'Stat lines', value: preview.statLines },
    { label: 'Quote', value: preview.quote },
    { label: 'Place', value: preview.placeLabel },
    { label: 'Date', value: preview.dateLabel },
  ].filter(f => (Array.isArray(f.value) ? f.value.length > 0 : !!f.value));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18, 19, 15, 0.98)',
        backdropFilter: 'blur(24px)',
        zIndex: 10001,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 20px',
        color: '#F6F1E7',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text variant="caption" style={{ color: '#C99A45', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
          SHARE AS CARD
        </Text>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(246,241,231,0.6)', fontSize: 20, cursor: 'pointer' }}>
          ✕
        </button>
      </div>

      {/* Live card preview */}
      <Card
        style={{
          backgroundColor: preview.theme === 'cream' ? '#F6F1E7' : '#0B0F08',
          color: preview.theme === 'cream' ? '#20211B' : '#F6F1E7',
          borderRadius: 16,
          padding: '28px 22px',
          marginBottom: 20,
          border: '1px solid var(--color-border)',
          minHeight: 220,
        }}
      >
        <div style={{ width: 48, height: 5, borderRadius: 3, backgroundColor: preview.theme === 'gold' ? '#C99A45' : '#84CC16', marginBottom: 18 }} />
        <Heading variant="headingLG" style={{ fontFamily: 'serif', color: 'inherit', marginBottom: 8 }}>
          {preview.title}
        </Heading>
        {preview.subtitle && (
          <Text style={{ color: preview.theme === 'gold' ? '#C99A45' : '#84CC16', marginBottom: 12, display: 'block' }}>{preview.subtitle}</Text>
        )}
        {preview.statLines.map((l, i) => (
          <Text key={i} style={{ color: 'inherit', display: 'block', fontSize: 14, opacity: 0.9 }}>
            •  {l}
          </Text>
        ))}
        {preview.quote && (
          <Text style={{ color: 'inherit', fontStyle: 'italic', marginTop: 12, display: 'block', opacity: 0.8 }}>"{preview.quote}"</Text>
        )}
        <Text variant="caption" style={{ opacity: 0.55, marginTop: 16, display: 'block' }}>
          EXTROVELA {preview.placeLabel ? `· ${preview.placeLabel}` : ''}
        </Text>
      </Card>

      {/* Template picker */}
      <Text variant="label" style={{ color: '#C99A45', fontSize: 11, letterSpacing: '0.1em', marginBottom: 8, display: 'block' }}>
        TEMPLATE
      </Text>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {SHARE_TEMPLATES.map(t => (
          <button
            key={t}
            onClick={() => changeTemplate(t)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: template === t ? '1px solid #84CC16' : '1px solid var(--color-border)',
              backgroundColor: template === t ? 'rgba(132,204,22,0.12)' : 'var(--color-surface)',
              color: template === t ? '#84CC16' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {SHARE_TEMPLATE_META[t].label}
          </button>
        ))}
      </div>

      {/* Transparency: exactly what becomes public */}
      <Card style={{ backgroundColor: 'rgba(32, 33, 27, 0.8)', borderRadius: 12, padding: 16, marginBottom: 20, border: '1px solid rgba(201, 154, 69, 0.2)' }}>
        <Text variant="label" style={{ color: '#84CC16', fontSize: 11, letterSpacing: '0.1em', marginBottom: 10, display: 'block' }}>
          WHAT BECOMES PUBLIC
        </Text>
        {publicFields.map(f => (
          <div key={f.label} style={{ marginBottom: 6 }}>
            <Text variant="caption" style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>
              {f.label}
            </Text>
            <Text style={{ color: 'var(--color-text)', fontSize: 13, display: 'block' }}>
              {Array.isArray(f.value) ? f.value.join(' · ') : f.value}
            </Text>
          </div>
        ))}
        <Text variant="caption" style={{ color: 'var(--color-text-secondary)', fontSize: 11, marginTop: 10, display: 'block', lineHeight: 1.5 }}>
          Your account, exact location, photos, and full reflection are never included. The link is a random,
          unguessable token you can revoke at any time.
        </Text>
      </Card>

      {/* Expiry */}
      {state !== 'published' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {EXPIRY_OPTIONS.map((opt, i) => (
            <button
              key={opt.label}
              onClick={() => setExpiryIdx(i)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: expiryIdx === i ? '1px solid #C99A45' : '1px solid var(--color-border)',
                backgroundColor: expiryIdx === i ? 'rgba(201,154,69,0.12)' : 'var(--color-surface)',
                color: expiryIdx === i ? '#C99A45' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Result / actions */}
      {state === 'published' && result ? (
        <Card style={{ backgroundColor: 'rgba(132,204,22,0.08)', border: '1px solid rgba(132,204,22,0.3)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Text variant="label" style={{ color: '#84CC16', fontSize: 11, marginBottom: 8, display: 'block' }}>
            ✓ LINK PUBLISHED
          </Text>
          <Text style={{ color: 'var(--color-text)', fontSize: 13, wordBreak: 'break-all', display: 'block', marginBottom: 12 }}>
            {result.webUrl}
          </Text>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={copyLink} style={{ flex: 1 }}>
              {copied ? 'Copied ✓' : 'Copy link'}
            </Button>
            <Button variant="danger" onClick={revoke} style={{ flex: 1 }}>
              Revoke
            </Button>
          </div>
        </Card>
      ) : (
        <Button
          variant="primary"
          onClick={publish}
          disabled={!userId || state === 'publishing'}
          style={{ width: '100%', marginBottom: 12 }}
        >
          {state === 'publishing' ? 'Publishing…' : userId ? 'Publish public link' : 'Sign in to share'}
        </Button>
      )}

      {state === 'error' && (
        <Text variant="bodySM" style={{ color: '#EF4444', display: 'block', marginBottom: 12 }}>
          Couldn't publish the link. Please check your connection and try again.
        </Text>
      )}

      <Button variant="secondary" onClick={onClose} style={{ width: '100%', marginTop: 'auto' }}>
        Done
      </Button>
    </div>
  );
};

export default ShareCardModal;
