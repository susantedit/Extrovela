import React, { useState, useEffect } from 'react';
import { Quest, QuestStep, SkipReason } from '../../types/quest';
import { QuestSession, QuestStateMachine } from './questStateMachine';
import { Button } from '../../components/primitives/Button';
import { Heading, Text } from '../../components/primitives/Typography';
import { Card } from '../../components/primitives/Card';
import { haptics } from '../../utils/haptics';
import { questSyncService } from '../../services/sync/questSyncService';
import { useAuth } from '../../context/AuthContext';

interface QuestExecutionModalProps {
  quest: Quest;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (session: QuestSession) => void;
  onSkip?: (session: QuestSession, reason: SkipReason) => void;
  onAbandon?: (session: QuestSession, note?: string) => void;
}

const SKIP_REASONS: { key: SkipReason; label: string }[] = [
  { key: 'too_far', label: 'Too far away' },
  { key: 'too_expensive', label: 'Too expensive' },
  { key: 'not_feeling_it', label: 'Not in the mood today' },
  { key: 'already_done', label: 'Already done this before' },
  { key: 'not_interested', label: 'Not my style' },
  { key: 'bad_timing', label: 'Weather or timing issue' },
  { key: 'other', label: 'Other reason' },
];

export const QuestExecutionModal: React.FC<QuestExecutionModalProps> = ({
  quest,
  isOpen,
  onClose,
  onComplete,
  onSkip,
  onAbandon,
}) => {
  const { user } = useAuth();
  const [session, setSession] = useState<QuestSession>(() => {
    return QuestStateMachine.createSession({
      userId: user?.uid || 'user_active',
      questId: quest.id,
      questTitle: quest.title,
      totalDurationMinutes: parseInt(quest.time) || 30,
    });
  });

  const [isPhoneFree, setIsPhoneFree] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [skipReason, setSkipReason] = useState<SkipReason>('not_feeling_it');
  const [abandonNote, setAbandonNote] = useState('');
  const [isCelebration, setIsCelebration] = useState(false);
  const [arrivalConfirmed, setArrivalConfirmed] = useState(false);

  // Synchronize state machine status from 'generated' -> 'inProgress' on launch
  useEffect(() => {
    if (isOpen && session.status === 'generated') {
      try {
        const viewed = QuestStateMachine.transition(session, 'viewed');
        const accepted = QuestStateMachine.transition(viewed, 'accepted');
        const started = QuestStateMachine.transition(accepted, 'started');
        const inProgress = QuestStateMachine.transition(started, 'inProgress');
        setSession(inProgress);
      } catch (err) {
        // Fallback state
        setSession(prev => ({ ...prev, status: 'inProgress' }));
      }
    }
  }, [isOpen]);

  // Robust timestamp-based interval timer that survives backgrounding
  useEffect(() => {
    let timer: any;
    if (isOpen && session.status === 'inProgress') {
      timer = setInterval(() => {
        setSession(prev => {
          const now = Date.now();
          const startMs = new Date(prev.startedAt).getTime();
          const computedElapsed = Math.max(0, Math.floor((now - startMs) / 1000));
          return {
            ...prev,
            elapsedSeconds: computedElapsed,
          };
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, session.status]);

  // The modal lives behind the authenticated router, so user.uid is normally
  // present when the session is seeded. Guard the rare case where auth resolves
  // a real uid AFTER mount: upgrade the session from the local fallback so the
  // captured memory is saved under the real account, never the mock 'user_active'.
  useEffect(() => {
    const uid = user?.uid;
    if (uid && session.userId === 'user_active') {
      setSession(prev => ({ ...prev, userId: uid }));
    }
  }, [user?.uid, session.userId]);

  if (!isOpen) return null;

  const steps: QuestStep[] = quest.chainSteps || [
    { stepNumber: 1, title: 'Begin Experience', description: quest.description }
  ];

  const minutes = Math.floor(session.elapsedSeconds / 60);
  const seconds = session.elapsedSeconds % 60;
  const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const handlePauseResume = () => {
    haptics.light();
    const nextStatus = session.status === 'inProgress' ? 'paused' : 'inProgress';
    const updated = QuestStateMachine.transition(session, nextStatus);
    setSession(updated);
    questSyncService.enqueue({
      idempotencyKey: `session_update_${updated.id}_${Date.now()}`,
      type: 'quest_session_update',
      userId: updated.userId,
      payload: updated,
    });
  };

  const handleNextStep = () => {
    haptics.light();
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      triggerCelebration();
    }
  };

  const triggerCelebration = () => {
    haptics.success();
    setIsCelebration(true);
  };

  const handleFinalizeCompletion = () => {
    const finalSession = QuestStateMachine.transition(session, 'completed');
    questSyncService.enqueue({
      idempotencyKey: `completion_${finalSession.id}`,
      type: 'quest_completion',
      userId: finalSession.userId,
      payload: finalSession,
    });
    onComplete(finalSession);
  };

  const handleConfirmSkip = () => {
    haptics.medium();
    const skippedSession = QuestStateMachine.transition(session, 'skipped', { skipReason });
    questSyncService.enqueue({
      idempotencyKey: `skip_${skippedSession.id}`,
      type: 'quest_session_update',
      userId: skippedSession.userId,
      payload: skippedSession,
    });
    if (onSkip) onSkip(skippedSession, skipReason);
    onClose();
  };

  const handleConfirmAbandon = () => {
    haptics.medium();
    const abandonedSession = QuestStateMachine.transition(session, 'abandoned', { abandonNote });
    questSyncService.enqueue({
      idempotencyKey: `abandon_${abandonedSession.id}`,
      type: 'quest_session_update',
      userId: abandonedSession.userId,
      payload: abandonedSession,
    });
    if (onAbandon) onAbandon(abandonedSession, abandonNote);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18, 19, 15, 0.96)',
        backdropFilter: 'blur(20px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 20px',
        color: '#F6F1E7',
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      {/* Top Navigation & Status Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <Text variant="caption" style={{ color: '#C99A45', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
            {session.status === 'paused' ? 'PAUSED' : 'EXPERIENCE IN PROGRESS'}
          </Text>
          <Heading variant="headingMD" style={{ color: '#F6F1E7', margin: '4px 0 0' }}>
            {quest.title}
          </Heading>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowSkipModal(true)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: 'rgba(246, 241, 231, 0.7)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Skip
          </button>
          <button
            onClick={() => setShowAbandonModal(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(246, 241, 231, 0.5)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Experience Display */}
      {isCelebration ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🌟</div>
          <Text variant="caption" style={{ color: '#84CC16', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>
            MOMENT COMPLETED
          </Text>
          <Heading variant="headingLG" style={{ color: '#F6F1E7', fontSize: '32px', margin: '8px 0 16px' }}>
            YOU DID IT.
          </Heading>
          <Text style={{ color: 'rgba(246, 241, 231, 0.8)', fontSize: '16px', maxWidth: '320px', marginBottom: '32px', lineHeight: 1.6 }}>
            What did this experience feel like? Let's preserve this memory.
          </Text>
          <Button variant="primary" onClick={handleFinalizeCompletion} style={{ width: '100%', maxWidth: '320px' }}>
            REFLECT & SAVE MEMORY →
          </Button>
        </div>
      ) : isPhoneFree ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>🍃</div>
          <Heading variant="headingLG" style={{ color: '#F6F1E7', marginBottom: '12px' }}>
            Phone-Free Mode
          </Heading>
          <Text style={{ color: 'rgba(246, 241, 231, 0.75)', lineHeight: 1.6, marginBottom: '28px', maxWidth: '320px' }}>
            Put your phone in your pocket. Experience the world around you. We are keeping track gently.
          </Text>
          <Button variant="glass" onClick={() => setIsPhoneFree(false)} style={{ color: '#C99A45', borderColor: 'rgba(201, 154, 69, 0.4)' }}>
            I'M BACK
          </Button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          {/* Non-stressful Timer */}
          <div style={{ marginBottom: '20px' }}>
            <Text variant="caption" style={{ color: 'rgba(246, 241, 231, 0.5)', letterSpacing: '0.1em' }}>
              TIME SUGESTED: {quest.time || '30 MIN'}
            </Text>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '52px',
                fontWeight: 300,
                color: session.status === 'paused' ? 'rgba(246, 241, 231, 0.4)' : '#C99A45',
                letterSpacing: '3px',
                marginTop: '4px',
              }}
            >
              {timeDisplay}
            </div>
          </div>

          {/* Stepper Progress Indicator */}
          {steps.length > 1 && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              {steps.map((s, idx) => (
                <div
                  key={s.stepNumber}
                  style={{
                    width: '32px',
                    height: '4px',
                    borderRadius: '2px',
                    backgroundColor: idx === currentStepIndex ? '#C99A45' : idx < currentStepIndex ? '#84CC16' : 'rgba(255,255,255,0.15)',
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </div>
          )}

          {/* Instruction Card */}
          <Card
            style={{
              backgroundColor: 'rgba(32, 33, 27, 0.85)',
              border: '1px solid rgba(201, 154, 69, 0.25)',
              padding: '24px 20px',
              marginBottom: '20px',
              textAlign: 'left',
              width: '100%',
              maxWidth: '380px',
            }}
          >
            <Text variant="caption" style={{ color: '#84CC16', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
              {steps.length > 1 ? `STEP ${currentStepIndex + 1} OF ${steps.length}` : 'CURRENT INVITATION'}
            </Text>
            <Heading variant="headingMD" style={{ color: '#F6F1E7', marginBottom: '8px' }}>
              {steps[currentStepIndex].title}
            </Heading>
            <Text style={{ color: 'rgba(246, 241, 231, 0.85)', fontSize: '15px', lineHeight: 1.6 }}>
              {steps[currentStepIndex].description}
            </Text>

            {/* Optional Arrival Confirmation */}
            {quest.starterQuest === false && !arrivalConfirmed && (
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                  type="button"
                  onClick={() => {
                    haptics.light();
                    setArrivalConfirmed(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#84CC16',
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  📍 Confirm arrival at destination
                </button>
              </div>
            )}
            {arrivalConfirmed && (
              <Text variant="caption" style={{ color: '#84CC16', marginTop: '12px' }}>
                ✓ Destination verified nearby.
              </Text>
            )}
          </Card>

          <Button
            variant="glass"
            onClick={() => setIsPhoneFree(true)}
            style={{ color: '#C99A45', borderColor: 'rgba(201, 154, 69, 0.3)', width: '100%', maxWidth: '380px', marginBottom: '12px' }}
          >
            📱 Enter Phone-Free Mode
          </Button>
        </div>
      )}

      {/* Bottom Controls */}
      {!isCelebration && (
        <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
          <Button variant="secondary" onClick={handlePauseResume} style={{ flex: 1 }}>
            {session.status === 'paused' ? 'RESUME' : 'PAUSE'}
          </Button>
          {steps.length > 1 && currentStepIndex < steps.length - 1 ? (
            <Button variant="primary" onClick={handleNextStep} style={{ flex: 2 }}>
              NEXT STEP →
            </Button>
          ) : (
            <Button variant="primary" onClick={triggerCelebration} style={{ flex: 2 }}>
              COMPLETE QUEST
            </Button>
          )}
        </div>
      )}

      {/* Skip Feedback Modal */}
      {showSkipModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 20 }}>
          <Card style={{ backgroundColor: '#20211B', border: '1px solid var(--color-border)', width: '100%', maxWidth: 360, padding: 20 }}>
            <Heading variant="headingMD" style={{ color: '#F6F1E7', marginBottom: 12 }}>
              Why skip this quest?
            </Heading>
            <Text variant="bodySM" color="secondary" style={{ marginBottom: 16 }}>
              Your feedback helps EXTROVELA suggest better real-world experiences.
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {SKIP_REASONS.map(r => (
                <button
                  key={r.key}
                  onClick={() => setSkipReason(r.key)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    textAlign: 'left',
                    backgroundColor: skipReason === r.key ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)',
                    color: skipReason === r.key ? '#000' : '#F6F1E7',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: skipReason === r.key ? 600 : 400,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowSkipModal(false)} style={{ flex: 1 }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmSkip} style={{ flex: 1 }}>
                Confirm Skip
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Abandon Modal */}
      {showAbandonModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 20 }}>
          <Card style={{ backgroundColor: '#20211B', border: '1px solid var(--color-border)', width: '100%', maxWidth: 360, padding: 20 }}>
            <Heading variant="headingMD" style={{ color: '#F6F1E7', marginBottom: 8 }}>
              Pause or finish later?
            </Heading>
            <Text variant="bodySM" color="secondary" style={{ marginBottom: 16 }}>
              No pressure. Your experience stays marked as unfinished, not failed.
            </Text>
            <textarea
              placeholder="What happened? (Optional)"
              value={abandonNote}
              onChange={e => setAbandonNote(e.target.value)}
              style={{
                width: '100%',
                height: 80,
                backgroundColor: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: 10,
                color: '#F6F1E7',
                fontSize: 14,
                marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowAbandonModal(false)} style={{ flex: 1 }}>
                Continue
              </Button>
              <Button variant="danger" onClick={handleConfirmAbandon} style={{ flex: 1 }}>
                Exit Quest
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default QuestExecutionModal;
