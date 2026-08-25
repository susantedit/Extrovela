import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  size = 'md',
  ariaLabel,
  className = '',
  ...props
}) => {
  const sizeStyle = size === 'lg' ? { width: 48, height: 48 } : size === 'sm' ? { width: 36, height: 36 } : { width: 44, height: 44 };

  return (
    <button
      type="button"
      className={`btn-icon ${className}`}
      style={sizeStyle}
      aria-label={ariaLabel}
      {...props}
    >
      {icon}
    </button>
  );
};
