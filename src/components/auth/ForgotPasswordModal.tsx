import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal, Input, Button, Heading, Text } from '../primitives';
import { triggerHaptic } from '../../lib/native-device';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { sendPasswordReset, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    triggerHaptic('medium');
    try {
      await sendPasswordReset(email);
      setIsSent(true);
    } catch {
      // Error handled by AuthContext
    }
  };

  const handleClose = () => {
    setIsSent(false);
    setEmail('');
    clearError();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth={440}>
      <div className="text-center">
        {isSent ? (
          <div className="py-12 animate-fade-in">
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(74, 124, 89, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <CheckCircle2 style={{ width: 28, height: 28, color: 'var(--color-success)' }} />
            </div>
            <Heading variant="headingMD" style={{ marginBottom: 6 }}>Check your inbox</Heading>
            <Text variant="bodySM" color="secondary" style={{ marginBottom: 20 }}>
              We've sent a password reset link to <strong>{email}</strong>.
            </Text>
            <Button variant="secondary" size="md" onClick={handleClose}>
              <span>Return to Sign In</span>
            </Button>
          </div>
        ) : (
          <div>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--color-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Mail style={{ width: 26, height: 26, color: 'var(--color-accent)' }} />
            </div>
            <Heading variant="headingMD" style={{ marginBottom: 6 }}>Reset Password</Heading>
            <Text variant="bodySM" color="secondary" style={{ marginBottom: 20 }}>
              Enter your email address and we will send you a link to reset your password.
            </Text>

            {error && (
              <div
                className="flex items-center gap-8 mb-16 text-xs text-left"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  color: 'var(--color-error)',
                }}
              >
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSend} className="flex flex-col gap-16 text-left">
              <Input
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                isLoading={isLoading}
              >
                <span>Send Reset Link</span>
              </Button>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
};
