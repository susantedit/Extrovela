import React, { useState } from 'react';
import { Mail, Lock, ArrowLeft, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card, Button, Input, Heading, Text, Badge } from '../primitives';
import { triggerHaptic } from '../../lib/native-device';

interface SignInScreenProps {
  onBack: () => void;
  onNavigateSignUp: () => void;
  onForgotPassword: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  onBack,
  onNavigateSignUp,
  onForgotPassword,
}) => {
  const { signInWithEmail, signInWithGoogle, signInAsGuest, error, isLoading, clearError } = useAuth();
  const { mode } = useTheme();
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

    if (!email || !email.includes('@')) {
      setValidationError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setValidationError('Password must be at least 6 characters.');
      return;
    }

    triggerHaptic('medium');
    await signInWithEmail(email, password);
  };

  const handleGoogle = async () => {
    triggerHaptic('medium');
    await signInWithGoogle();
  };

  return (
    <div className="app-shell flex items-center justify-center py-48 px-20 relative overflow-hidden">
      <div className="ambient-glow ambient-glow-top" />

      <div className="container animate-slide-up" style={{ maxWidth: 440, position: 'relative', zIndex: 1 }}>
        {/* Back navigation */}
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
            <Badge variant="brand" mono className="mb-8">WELCOME BACK</Badge>
            <Heading variant="headingLG" style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>
              Sign in to your journey
            </Heading>
            <Text variant="bodySM" color="secondary">
              Resume your explored life map and memories.
            </Text>
          </div>

          {/* Error Banner */}
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

          {/* Social OAuth Buttons */}
          <div className="flex flex-col gap-10 mb-20">
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full"
              isLoading={isLoading}
              onClick={handleGoogle}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: 6 }}>
                <path fill="#EA4335" d="M12 5c1.7 0 3 .6 4 1.5l3-3C17.2 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.4-.4-2.3s.2-1.5.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.4 7.5 23.5 12 23.5z"/>
              </svg>
              <span>Continue with Google</span>
            </Button>
          </div>

          <div className="flex items-center gap-12 my-20">
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span className="font-mono text-xs text-muted uppercase">or with email</span>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-16">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />

            <div>
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <div className="text-right mt-6">
                <button
                  type="button"
                  className="btn-ghost text-xs text-muted"
                  onClick={() => {
                    triggerHaptic('light');
                    onForgotPassword();
                  }}
                  style={{ padding: 0, textDecoration: 'underline' }}
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-8"
              isLoading={isLoading}
            >
              <span>Sign In</span>
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

          {/* Footer Link */}
          <div className="text-center mt-24 pt-16 border-top">
            <Text variant="bodySM" color="muted">
              Don't have an account?{' '}
              <button
                type="button"
                className="btn-ghost font-bold text-accent"
                onClick={() => {
                  triggerHaptic('light');
                  onNavigateSignUp();
                }}
                style={{ padding: 0, display: 'inline' }}
              >
                Sign Up
              </button>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};
