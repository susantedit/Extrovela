/**
 * EXTROVELA — Group Quest Session Modal (Phase 9)
 * 
 * Shared quest execution interface with companion lobby, synchronized timer,
 * collaborative step guidance, and individual reflection triggers upon completion.
 */

import React, { useState, useEffect } from 'react';
import { Users, Pause, Play, CheckCircle, Flag, X } from 'lucide-react';
import { Quest } from '../../types/quest';
import { GroupQuestSession } from '../../types/social';
import { GroupQuestSessionService } from '../../services/social';
import { Card, Button, Badge, Heading, Text } from '../../components/primitives';
import { haptics } from '../../utils/haptics';

interface GroupQuestSessionModalProps {
  quest: Quest;
  session: GroupQuestSession;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (sharedExp: any) => void;
}

export const GroupQuestSessionModal: React.FC<GroupQuestSessionModalProps> = ({
  quest,
  session,
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentSession, setCurrentSession] = useState<GroupQuestSession>(session);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    setCurrentSession(session);
  }, [session]);

  // Timer loop
  useEffect(() => {
    if (!isOpen || isPaused || currentSession.state !== 'active') return;

    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isPaused, currentSession.state]);

  if (!isOpen) return null;

  const handleStartTogether = () => {
    haptics.success();
    setCurrentSession(prev => ({ ...prev, state: 'active', startedAt: new Date().toISOString() }));
  };

  const handleTogglePause = () => {
    haptics.medium();
    setIsPaused(!isPaused);
  };

  const handleCompleteQuest = async () => {
    haptics.success();
    const sharedExp = await GroupQuestSessionService.completeGroupSession(currentSession, quest.title);
    onComplete(sharedExp);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(23, 24, 19, 0.98)',
        backdropFilter: 'blur(24px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px',
        color: '#F6F1E7',
      }}
    >
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge variant="brand" mono>GROUP EXPERIENCE</Badge>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#C99A45' }}>
            <Users size={14} />
            <span>{currentSession.participants.length} Companions</span>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.6)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Body */}
      <div style={{ maxWidth: 500, margin: '0 auto', width: '100%', textAlign: 'center' }}>
        {currentSession.state === 'waiting' ? (
          /* Waiting Lobby */
          <div>
            <Heading variant="display" style={{ fontFamily: 'serif', marginBottom: 12 }}>
              Ready to Explore Together?
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 28 }}>
              {quest.title}
            </Text>

            <Card style={{ backgroundColor: '#22231D', border: '1px solid rgba(86, 100, 58, 0.3)', padding: 20, marginBottom: 28, textAlign: 'left' }}>
              <Text variant="label" style={{ color: '#C99A45', marginBottom: 12, display: 'block' }}>
                WHO'S COMING
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {currentSession.participants.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#84CC16' }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{p.displayName}</span>
                    {p.role === 'creator' && <span style={{ fontSize: 11, color: '#C99A45' }}>(Host)</span>}
                  </div>
                ))}
              </div>
            </Card>

            <Button variant="primary" onClick={handleStartTogether} style={{ width: '100%', padding: '16px' }}>
              START TOGETHER
            </Button>
          </div>
        ) : (
          /* Active Shared Session */
          <div>
            <div style={{ fontSize: 48, fontWeight: 900, fontFamily: 'monospace', color: '#C99A45', marginBottom: 12 }}>
              {formatTime(elapsedSeconds)}
            </div>

            <Heading variant="headingLG" style={{ fontFamily: 'serif', marginBottom: 8 }}>
              {quest.title}
            </Heading>

            <Text variant="bodySM" color="secondary" style={{ marginBottom: 24 }}>
              {quest.description}
            </Text>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Button variant="glass" onClick={handleTogglePause} leftIcon={isPaused ? <Play size={16} /> : <Pause size={16} />}>
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button variant="primary" onClick={handleCompleteQuest} leftIcon={<CheckCircle size={16} />}>
                Complete Together
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Safety Bar */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(246, 241, 231, 0.4)' }}>
        <Flag size={13} />
        <span>Report or leave at any time safely</span>
      </div>
    </div>
  );
};
