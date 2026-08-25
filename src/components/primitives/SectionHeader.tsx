import React from 'react';
import { Heading, Text } from './Typography';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  badge,
  action,
  align = 'left',
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between mb-20 ${align === 'center' ? 'text-center justify-center' : ''} ${className}`} style={{ flexWrap: 'wrap', gap: 12 }}>
      <div>
        {badge && <span className="pill pill-brand mb-6 font-mono text-xs">{badge}</span>}
        <Heading variant="headingLG" style={{ fontSize: 'clamp(20px, 3.5vw, 28px)' }}>
          {title}
        </Heading>
        {subtitle && <Text variant="bodySM" color="muted" style={{ marginTop: 4 }}>{subtitle}</Text>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
