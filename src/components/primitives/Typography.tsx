import React from 'react';

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'display' | 'headingXL' | 'headingLG' | 'headingMD' | 'bodyLG' | 'bodyMD' | 'bodySM' | 'caption' | 'label';
  color?: 'primary' | 'secondary' | 'muted' | 'accent' | 'inverse' | 'brand';
  as?: React.ElementType;
}

export const Heading: React.FC<TypographyProps> = ({
  variant = 'headingLG',
  color = 'primary',
  as,
  className = '',
  children,
  ...props
}) => {
  const Component = as || (variant === 'display' || variant === 'headingXL' ? 'h1' : variant === 'headingLG' ? 'h2' : 'h3');
  const colorClass = `text-${color}`;

  return (
    <Component className={`font-display ${colorClass} ${className}`} {...props}>
      {children}
    </Component>
  );
};

export const Text: React.FC<TypographyProps> = ({
  variant = 'bodyMD',
  color = 'secondary',
  as = 'p',
  className = '',
  children,
  ...props
}) => {
  const Component = as;
  const colorClass = `text-${color}`;

  return (
    <Component className={`font-sans ${colorClass} ${className}`} {...props}>
      {children}
    </Component>
  );
};

export const Label: React.FC<TypographyProps> = ({
  color = 'muted',
  className = '',
  children,
  ...props
}) => {
  return (
    <span className={`form-label text-${color} ${className}`} {...props}>
      {children}
    </span>
  );
};
