import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'accent' | 'sunset' | 'cyan' | 'gold' | 'violet' | 'pink' | 'emerald';
  mono?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'brand',
  mono = false,
  children,
  className = '',
  ...props
}) => {
  const variantClass = `pill-${variant}`;
  const monoClass = mono ? 'font-mono' : '';

  return (
    <span className={`pill ${variantClass} ${monoClass} ${className}`} {...props}>
      {children}
    </span>
  );
};
