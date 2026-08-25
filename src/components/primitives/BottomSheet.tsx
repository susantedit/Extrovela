import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bottom-sheet animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        {title && (
          <div className="flex items-center justify-between mb-16">
            <h3 className="font-display" style={{ fontSize: 18, fontWeight: 800 }}>{title}</h3>
            <IconButton
              icon={<X style={{ width: 16, height: 16 }} />}
              size="sm"
              ariaLabel="Close sheet"
              onClick={onClose}
            />
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
};
