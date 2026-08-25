import React from 'react';
import { Compass, Sparkles, ArrowRight, UserCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button, Heading, Text, Badge } from '../primitives';
import { triggerHaptic } from '../../lib/native-device';

interface WelcomeScreenProps {
  onNavigateSignIn: () => void;
  onNavigateSignUp: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onNavigateSignIn,
  onNavigateSignUp,
}) => {
  const { signInAsGuest, isLoading } = useAuth();
  const { mode } = useTheme();

  const handleGuest = async () => {
    triggerHaptic('medium');
    await signInAsGuest();
  };

  return (
    <div className="app-shell flex items-center justify-center py-48 px-20 text-center relative overflow-hidden">
      {/* Cinematic Ambient Glows */}
      <div className="ambient-glow ambient-glow-top animate-pulse-glow" style={{ top: '-40px', left: '15%' }} />
      <div className="ambient-glow ambient-glow-bottom" style={{ bottom: '-60px', right: '15%' }} />

      <div className="container animate-slide-up" style={{ maxWidth: 540, position: 'relative', zIndex: 1 }}>
        {/* Brand Logo (Theme-aware: Light vs Dark) */}
        <div className="flex justify-center mb-28">
          <img
            src={mode === 'light' ? '/logo-light.png' : '/logo-dark.png'}
            alt="EXTROVELA"
            style={{
              height: 'clamp(80px, 16vw, 130px)',
              width: 'auto',
              maxWidth: '85vw',
              objectFit: 'contain',
              filter: 'drop-shadow(0 12px 28px rgba(0, 0, 0, 0.35))',
            }}
          />
        </div>

        <Badge variant="brand" mono className="mb-16">
          REAL-WORLD EXPERIENCE ENGINE
        </Badge>

        <Heading variant="display" style={{ fontSize: 'clamp(32px, 6vw, 52px)', fontWeight: 900, lineHeight: 1.12, marginBottom: 14 }}>
          STOP SCROLLING.
          <br />
          <span className="text-accent">START EXPERIENCING.</span>
        </Heading>

        <Text variant="bodyLG" color="secondary" style={{ maxWidth: 440, margin: '0 auto 36px', lineHeight: 1.6 }}>
          Discover something worth remembering. EXTROVELA turns ordinary days into unexpected real-world adventures.
        </Text>

        {/* Primary Action Buttons */}
        <div className="flex flex-col gap-12 max-w-sm mx-auto mb-28" style={{ maxWidth: 360, margin: '0 auto 28px' }}>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isLoading}
            onClick={handleGuest}
            rightIcon={<ArrowRight style={{ width: 16, height: 16 }} />}
          >
            <span>Start Exploring</span>
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="w-full"
            onClick={() => {
              triggerHaptic('light');
              onNavigateSignIn();
            }}
          >
            <span>I already have an account</span>
          </Button>
        </div>

        {/* Guest Footnote */}
        <div className="flex items-center justify-center gap-6 text-xs text-muted font-mono">
          <ShieldCheck style={{ width: 13, height: 13, color: 'var(--color-secondary)' }} />
          <span>Low-friction guest entry. Zero upfront commitment.</span>
        </div>
      </div>
    </div>
  );
};
