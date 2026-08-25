import React from 'react';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  color?: 'lime' | 'sunset' | 'cyan' | 'gold' | 'violet' | 'pink' | 'emerald';
}

export const Chip: React.FC<ChipProps> = ({
  selected = false,
  color = 'lime',
  children,
  className = '',
  ...props
}) => {
  const selectedClass = selected ? `selected selected-${color}` : '';

  return (
    <button
      type="button"
      className={`chip ${selectedClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
