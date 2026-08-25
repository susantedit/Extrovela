import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal, Input, Button, Heading, Text, Badge } from '../primitives';
import { triggerHaptic } from '../../lib/native-device';

interface AccountLinkingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountLinkingModal: React.FC<AccountLinkingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { linkAccountToEmail, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || password.length < 6) return;
    triggerHaptic('medium');
    try {
      await linkAccountToEmail(email, password);
      setIsSuccess(true);
    } catch {
      // Error in context
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setEmail('');
    setPassword('');
    clearError();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth={460}>
      <div>
        {isSuccess ? (
          <div className="text-center py-16 animate-fade-in">
            <div
              style={{
                width: 54,
                height: 54,
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
            <Heading variant="headingLG" style={{ marginBottom: 6 }}>Account Saved</Heading>
            <Text variant="bodySM" color="secondary" style={{ marginBottom: 20 }}>
              Your guest exploration memories and personalization profile are now permanently linked to <strong>{email}</strong>.
            </Text>
            <Button variant="primary" size="md" onClick={handleClose}>
              <span>Continue Exploring</span>
            </Button>
          </div>
        ) : (
          <div>
            <Badge variant="brand" mono className="mb-8">ACCOUNT UPGRADE</Badge>
            <Heading variant="headingLG" style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
              Save your experience profile
            </Heading>
            <Text variant="bodySM" color="secondary" style={{ marginBottom: 20 }}>
              Link your guest profile to an email and password so you never lose your progress or unlocked districts.
            </Text>

            {error && (
              <div
                className="flex items-center gap-8 mb-16 text-xs"
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

            <form onSubmit={handleLink} className="flex flex-col gap-14">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              <Input
                label="Create Password (min 6 characters)"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-4"
                isLoading={isLoading}
              >
                <span>Link & Save Account</span>
              </Button>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
};
