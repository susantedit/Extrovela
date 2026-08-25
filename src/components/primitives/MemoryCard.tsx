import React from 'react';
import { Calendar as CalendarIcon, MapPin, Star } from 'lucide-react';
import { Memory } from '../../types';
import { Card } from './Card';
import { Heading, Text } from './Typography';

export interface MemoryCardProps {
  memory: Memory;
  onClick?: () => void;
  className?: string;
}

export const MemoryCard: React.FC<MemoryCardProps> = ({
  memory,
  onClick,
  className = '',
}) => {
  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      className={`animate-slide-up ${className}`}
      style={{ cursor: onClick ? 'pointer' : 'default', padding: 0 }}
    >
      {/* Photo Container */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
        <img
          src={memory.photoUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80'}
          alt={memory.questTitle}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />

        {/* Date Badge */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            color: '#F8FAFC',
            fontSize: 11,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <CalendarIcon style={{ width: 11, height: 11 }} />
          <span>{new Date(memory.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>

        {/* Mood Stars */}
        <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 2 }}>
          {[...Array(memory.moodRating)].map((_, i) => (
            <Star key={i} style={{ width: 13, height: 13, fill: 'var(--color-accent)', color: 'var(--color-accent)' }} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 20 }}>
        <Heading variant="headingMD" style={{ fontSize: 17, marginBottom: 8 }}>
          {memory.questTitle}
        </Heading>
        <Text variant="bodySM" color="secondary" style={{ fontStyle: 'italic', lineHeight: 1.55 }}>
          "{memory.reflectionText}"
        </Text>
        <div className="flex items-center gap-6 mt-14 pt-12 border-top text-xs" style={{ color: 'var(--color-accent)' }}>
          <MapPin style={{ width: 12, height: 12 }} />
          <span>{memory.location.placeName || memory.location.city}</span>
        </div>
      </div>
    </Card>
  );
};
