import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  glow?: 'lime' | 'sunset' | 'none';
}

export const Card: React.FC<CardProps> = ({
  interactive = false,
  glow = 'none',
  children,
  className = '',
  ...props
}) => {
  const interactiveClass = interactive ? 'glass-card-interactive' : '';
  const glowElement = glow !== 'none' ? <div className={`ambient-glow ambient-glow-${glow === 'lime' ? 'top' : 'bottom'}`} /> : null;

  return (
    <div className={`glass-card ${interactiveClass} ${className}`} {...props}>
      {glowElement}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
};
