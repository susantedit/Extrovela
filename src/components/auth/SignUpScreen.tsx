import React, { useState } from 'react';
import { ArrowLeft, AlertCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card, Button, Input, Heading, Text, Badge } from '../primitives';
import { triggerHaptic } from '../../lib/native-device';

interface SignUpScreenProps {
  onBack: () => void;
  onNavigateSignIn: () => void;
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({
  onBack,
  onNavigateSignIn,
}) => {
  const { signUpWithEmail, signInAsGuest, error, isLoading, clearError } = useAuth();
  const { mode } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSkip = async () => {
    triggerHaptic('medium');
    await signInAsGuest();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    if (!name.trim()) {
      setValidationError('Please enter your name or preferred moniker.');
      return;
    }
    if (!email || !email.includes('@')) {
      setValidationError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setValidationError('Password must be at least 6 characters.');
      return;
    }

    triggerHaptic('medium');
    await signUpWithEmail(name.trim(), email, password);
  };

  return (
    <div className="app-shell flex items-center justify-center py-48 px-20 relative overflow-hidden">
      <div className="ambient-glow ambient-glow-top" />

      <div className="container animate-slide-up" style={{ maxWidth: 440, position: 'relative', zIndex: 1 }}>
        <div className="flex items-center justify-between mb-24">
          <button
            type="button"
            className="btn-ghost flex items-center gap-6 text-xs font-bold"
            onClick={() => {
              triggerHaptic('light');
              onBack();
            }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            <span>Back</span>
          </button>
          <span className="font-mono text-xs text-accent">EXTROVELA</span>
        </div>

        <Card style={{ padding: '32px 28px' }}>
          {/* Brand Logo */}
          <div className="flex justify-center mb-20">
            <img
              src={mode === 'light' ? '/logo-light.png' : '/logo-dark.png'}
              alt="EXTROVELA"
              style={{
                height: 'clamp(56px, 12vw, 84px)',
                width: 'auto',
                maxWidth: '80%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.25))',
              }}
            />
          </div>

          <div className="mb-24 text-center">
            <Badge variant="brand" mono className="mb-8">BEGIN YOUR ADVENTURE</Badge>
            <Heading variant="headingLG" style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>
              Create your account
            </Heading>
            <Text variant="bodySM" color="secondary">
              Save your memories and experience profile forever.
            </Text>
          </div>

          {(error || validationError) && (
            <div
              className="flex items-center gap-8 mb-20 text-xs font-semibold"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                color: 'var(--color-error)',
              }}
            >
              <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
              <span>{validationError || error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-16">
            <Input
              label="Your Name"
              placeholder="e.g. Alex"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password (min 6 characters)"
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
              className="w-full mt-8"
              isLoading={isLoading}
            >
              <span>Create Account</span>
            </Button>

            {/* Skip & Do Later Option */}
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={handleSkip}
              style={{
                marginTop: 6,
                fontSize: 13,
                color: 'var(--color-text-secondary)',
                border: '1px dashed var(--color-border-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Sparkles style={{ width: 14, height: 14, color: 'var(--color-accent)' }} />
              <span>Skip & Do Later (Continue as Guest)</span>
            </button>
          </form>

          <div className="text-center mt-24 pt-16 border-top">
            <Text variant="bodySM" color="muted">
              Already have an account?{' '}
              <button
                type="button"
                className="btn-ghost font-bold text-accent"
                onClick={() => {
                  triggerHaptic('light');
                  onNavigateSignIn();
                }}
                style={{ padding: 0, display: 'inline' }}
              >
                Sign In
              </button>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};
