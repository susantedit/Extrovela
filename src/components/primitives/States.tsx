import React from 'react';
import { Compass, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { Heading, Text } from './Typography';

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'Crafting your real-world experience…',
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-48 gap-16 animate-fade-in">
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Compass style={{ width: 28, height: 28, color: 'var(--color-accent)', animation: 'spin 4s linear infinite' }} />
      </div>
      <div>
        <Heading variant="headingMD">{message}</Heading>
        <Text variant="bodySM" color="muted" style={{ marginTop: 4 }}>Looking beyond algorithms and screens…</Text>
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}> = ({
  title = 'Your story starts here.',
  description = 'Complete your first real-world quest to reveal your life experience journal.',
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="glass-card text-center py-48 px-24 animate-fade-in" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        {icon || <Compass style={{ width: 26, height: 26, color: 'var(--color-accent)' }} />}
      </div>
      <Heading variant="headingMD" style={{ marginBottom: 6 }}>{title}</Heading>
      <Text variant="bodySM" color="secondary" style={{ maxWidth: 360, margin: '0 auto 20px', lineHeight: 1.6 }}>
        {description}
      </Text>
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          <span>{actionLabel}</span>
        </Button>
      )}
    </div>
  );
};

export const ErrorState: React.FC<{
  title?: string;
  message?: string;
  onRetry?: () => void;
}> = ({
  title = 'Something interrupted the adventure.',
  message = 'We could not load this experience right now. Let’s try again.',
  onRetry,
}) => {
  return (
    <div className="glass-card text-center py-40 px-24 animate-fade-in" style={{ maxWidth: 440, margin: '0 auto', borderColor: 'var(--color-border)' }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'rgba(217, 119, 6, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
        }}
      >
        <AlertCircle style={{ width: 24, height: 24, color: 'var(--color-warning)' }} />
      </div>
      <Heading variant="headingMD" style={{ marginBottom: 6 }}>{title}</Heading>
      <Text variant="bodySM" color="secondary" style={{ marginBottom: 20 }}>{message}</Text>
      {onRetry && (
        <Button variant="secondary" size="md" onClick={onRetry} leftIcon={<RefreshCw style={{ width: 14, height: 14 }} />}>
          <span>Try Again</span>
        </Button>
      )}
    </div>
  );
};
