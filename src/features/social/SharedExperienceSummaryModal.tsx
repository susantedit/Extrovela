/**
 * EXTROVELA — Shared Experience Summary Modal (Phase 9)
 * 
 * Celebrates completing a group quest together and invites each participant
 * to save their own independent memory and private reflection.
 */

import React from 'react';
import { Users, Sparkles, Heart } from 'lucide-react';
import { SharedExperience } from '../../types/social';
import { Card, Button, Badge, Heading, Text } from '../../components/primitives';
import { haptics } from '../../utils/haptics';

interface SharedExperienceSummaryModalProps {
  sharedExp: SharedExperience;
  isOpen: boolean;
  onClose: () => void;
  onRecordReflection: () => void;
}

export const SharedExperienceSummaryModal: React.FC<SharedExperienceSummaryModalProps> = ({
  sharedExp,
  isOpen,
  onClose,
  onRecordReflection,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(23, 24, 19, 0.96)',
        backdropFilter: 'blur(20px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 480,
          backgroundColor: '#22231D',
          border: '1px solid rgba(201, 154, 69, 0.4)',
          borderRadius: 24,
          padding: 28,
          textAlign: 'center',
          color: '#F6F1E7',
        }}
      >
        <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(201, 154, 69, 0.15)', border: '2px solid #C99A45', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#C99A45' }}>
          <Sparkles size={28} />
        </div>

        <Badge variant="brand" mono className="mb-8">SHARED JOURNEY COMPLETE</Badge>

        <Heading variant="display" style={{ fontFamily: 'serif', fontSize: 24, marginBottom: 8 }}>
          You Experienced This Together.
        </Heading>

        <Text variant="bodySM" color="secondary" style={{ marginBottom: 20 }}>
          {sharedExp.questTitle}
        </Text>

        <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 14, padding: '14px 18px', marginBottom: 24, textAlign: 'left' }}>
          <Text variant="label" style={{ color: '#C99A45', marginBottom: 6, display: 'block' }}>
            COMPANIONS
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sharedExp.participantNames.map(name => (
              <span
                key={name}
                style={{
                  backgroundColor: 'rgba(201, 154, 69, 0.12)',
                  border: '1px solid rgba(201, 154, 69, 0.3)',
                  padding: '4px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  color: '#F6F1E7',
                  fontWeight: 600,
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        <Text variant="bodySM" style={{ color: 'rgba(246, 241, 231, 0.7)', marginBottom: 24, lineHeight: 1.5 }}>
          Your shared connection is preserved. Now capture your own individual thoughts and personal photo.
        </Text>

        <div style={{ display: 'flex', gap: 12 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>
            CLOSE
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              haptics.selection();
              onRecordReflection();
            }}
            style={{ flex: 2 }}
          >
            CAPTURE MY REFLECTION
          </Button>
        </div>
      </Card>
    </div>
  );
};
