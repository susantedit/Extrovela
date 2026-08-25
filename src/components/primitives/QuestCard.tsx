import React, { useState } from 'react';
import { Clock, DollarSign, Users, Sparkles, ArrowRight, Lightbulb } from 'lucide-react';
import { Quest } from '../../types';
import { Card } from './Card';
import { Button } from './Button';
import { Badge } from './Badge';
import { Heading, Text } from './Typography';

export interface QuestCardProps {
  quest: Quest;
  isTodayFeatured?: boolean;
  onStart: (quest: Quest) => void;
  className?: string;
}

export const QuestCard: React.FC<QuestCardProps> = ({
  quest,
  isTodayFeatured = false,
  onStart,
  className = '',
}) => {
  const [isRevealed, setIsRevealed] = useState(!isTodayFeatured);

  return (
    <Card
      glow={isTodayFeatured ? 'lime' : 'none'}
      className={`animate-slide-up ${className}`}
      style={{
        padding: isTodayFeatured ? 'clamp(24px, 4.5vw, 36px)' : 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        borderWidth: isTodayFeatured ? 2 : 1,
        borderColor: isTodayFeatured ? 'var(--color-border-accent)' : 'var(--color-border)',
      }}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Badge variant={isTodayFeatured ? 'brand' : 'accent'} mono>
          {isTodayFeatured ? "TODAY'S QUEST" : quest.category}
        </Badge>
        <span className="font-mono text-xs text-muted" style={{ padding: '4px 10px', background: 'var(--color-surface-elevated)', borderRadius: 'var(--radius-full)' }}>
          {quest.time} • {quest.budget}
        </span>
      </div>

      {/* Quest Title & Description */}
      <div>
        <Heading
          variant={isTodayFeatured ? 'headingXL' : 'headingLG'}
          style={{ marginBottom: 10, fontSize: isTodayFeatured ? 'clamp(24px, 4vw, 34px)' : '20px' }}
        >
          {quest.title}
        </Heading>
        <Text variant="bodyMD" color="secondary" style={{ lineHeight: 1.65 }}>
          {quest.description}
        </Text>
      </div>

      {/* "Why this quest?" Contextual Intelligence Badge */}
      {quest.whyThisQuest && (
        <div
          style={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border-accent)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            fontSize: 13,
            color: 'var(--color-text)',
          }}
        >
          <div className="flex items-center gap-6 font-mono text-xs text-accent font-bold mb-2 uppercase">
            <Lightbulb style={{ width: 13, height: 13 }} />
            <span>Why this quest?</span>
          </div>
          <span style={{ opacity: 0.9 }}>{quest.whyThisQuest}</span>
        </div>
      )}

      {/* Footer & Call to Action */}
      <div className="border-top pt-16 flex items-center justify-between" style={{ marginTop: 'auto', flexWrap: 'wrap', gap: 12 }}>
        <div className="flex items-center gap-12 font-mono text-xs text-muted">
          <span className="flex items-center gap-4">
            <Clock style={{ width: 13, height: 13, color: 'var(--color-accent)' }} />
            {quest.time}
          </span>
          <span className="flex items-center gap-4">
            <DollarSign style={{ width: 13, height: 13, color: 'var(--color-secondary)' }} />
            {quest.budget}
          </span>
          <span className="flex items-center gap-4">
            <Users style={{ width: 13, height: 13, color: 'var(--color-accent)' }} />
            {quest.social}
          </span>
        </div>

        <Button
          variant="primary"
          size={isTodayFeatured ? 'lg' : 'md'}
          onClick={() => onStart(quest)}
          rightIcon={<ArrowRight style={{ width: 15, height: 15 }} />}
        >
          <span>START QUEST</span>
        </Button>
      </div>
    </Card>
  );
};
