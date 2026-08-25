import React, { useState } from 'react';
import { Dices, X, Sparkles, Zap, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Quest } from '../types';
import { MOCK_QUICK_ESCAPES } from '../constants/mockData';
import { Card, Button, Badge, Heading, Text } from './primitives';
import { triggerHaptic } from '../lib/native-device';

interface QuestSpinnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuest: (quest: Quest) => void;
}

export const QuestSpinnerModal: React.FC<QuestSpinnerModalProps> = ({
  isOpen,
  onClose,
  onSelectQuest,
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

  if (!isOpen) return null;

  const handleSpin = () => {
    if (isSpinning) return;

    triggerHaptic('medium');
    setIsSpinning(true);
    setSelectedQuest(null);

    // Random choice from MOCK_QUICK_ESCAPES
    const randomIndex = Math.floor(Math.random() * MOCK_QUICK_ESCAPES.length);
    const chosen = MOCK_QUICK_ESCAPES[randomIndex];

    // Calculate rotation: 5 full spins (1800 deg) + segment offset
    const segmentAngle = 360 / MOCK_QUICK_ESCAPES.length;
    const targetAngle = 1800 + (360 - (randomIndex * segmentAngle));

    setRotationDegrees(prev => prev + targetAngle);

    setTimeout(() => {
      setIsSpinning(false);
      setSelectedQuest(chosen);
      triggerHaptic('success');

      // Trigger confetti celebration
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#84CC16', '#C99A45', '#F59E0B'],
        });
      } catch {
        // Fallback if confetti script unavailable
      }
    }, 3200);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(23, 24, 19, 0.95)',
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
          border: '1px solid rgba(201, 154, 69, 0.35)',
          borderRadius: 24,
          padding: 24,
          color: '#F6F1E7',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={20} style={{ color: '#C99A45' }} />
            <Badge variant="brand" mono>INSTANT ADVENTURE WHEEL</Badge>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.6)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <Heading variant="headingLG" style={{ fontFamily: 'serif', marginBottom: 4 }}>
          Don't Know What to Do?
        </Heading>
        <Text variant="bodySM" color="secondary" style={{ marginBottom: 20 }}>
          Spin the wheel for an instant micro-adventure personalized for right now.
        </Text>

        {/* Wheel Graphic Container */}
        <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto 24px' }}>
          {/* Wheel Pointer Arrow */}
          <div
            style={{
              position: 'absolute',
              top: -12,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '12px solid transparent',
              borderRight: '12px solid transparent',
              borderTop: '20px solid #C99A45',
              zIndex: 10,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
            }}
          />

          {/* Rotating Wheel */}
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '4px solid #C99A45',
              boxShadow: '0 0 30px rgba(201, 154, 69, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              transform: `rotate(${rotationDegrees}deg)`,
              transition: isSpinning ? 'transform 3.2s cubic-bezier(0.15, 0.9, 0.2, 1)' : 'none',
              background: 'conic-gradient(#84CC16 0deg 60deg, #F59E0B 60deg 120deg, #6366F1 120deg 180deg, #EC4899 180deg 240deg, #10B981 240deg 300deg, #C99A45 300deg 360deg)',
            }}
          >
            {/* Center Cap */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: '#171813',
                border: '3px solid #C99A45',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#C99A45',
              }}
            >
              <Dices size={28} />
            </div>
          </div>
        </div>

        {/* Selected Quest Result */}
        {selectedQuest ? (
          <div className="animate-slide-up" style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, marginBottom: 20 }}>
            <Badge variant="accent" mono style={{ marginBottom: 6 }}>{selectedQuest.category}</Badge>
            <Heading variant="headingMD" style={{ color: '#F6F1E7', marginBottom: 4 }}>
              {selectedQuest.title}
            </Heading>
            <Text variant="bodySM" color="secondary" style={{ lineHeight: 1.5, marginBottom: 14 }}>
              {selectedQuest.description}
            </Text>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => {
                onClose();
                onSelectQuest(selectedQuest);
              }}
              rightIcon={<ArrowRight size={16} />}
            >
              ACCEPT THIS QUEST
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isSpinning}
            onClick={handleSpin}
          >
            <span>{isSpinning ? 'SPINNING THE WHEEL...' : 'SPIN FOR ADVENTURE'}</span>
          </Button>
        )}
      </Card>
    </div>
  );
};

export default QuestSpinnerModal;
