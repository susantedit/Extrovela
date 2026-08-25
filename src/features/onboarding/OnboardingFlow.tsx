import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Compass,
  Sparkles,
  MapPin,
  Bell,
  CheckCircle2,
  Trees,
  Coffee,
  Camera,
  BookOpen,
  Music,
  Users,
  Shield,
  Zap,
} from 'lucide-react';
import { OnboardingState, INITIAL_ONBOARDING_STATE } from '../../types/onboarding';
import { Card, Button, Input, Heading, Text, Badge, Chip } from '../../components/primitives';
import { analytics } from '../../services/firebase/firebaseAnalytics';
import { triggerHaptic } from '../../lib/native-device';

import { useTheme } from '../../context/ThemeContext';

interface OnboardingFlowProps {
  onComplete: (state: OnboardingState) => void;
}

const TOTAL_STEPS = 13;

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { mode } = useTheme();
  const [state, setState] = useState<OnboardingState>(() => {
    const saved = localStorage.getItem('extrovela_onboarding_temp_state');
    if (saved) {
      try {
        return { ...INITIAL_ONBOARDING_STATE, ...JSON.parse(saved) };
      } catch {
        return INITIAL_ONBOARDING_STATE;
      }
    }
    return INITIAL_ONBOARDING_STATE;
  });

  useEffect(() => {
    localStorage.setItem('extrovela_onboarding_temp_state', JSON.stringify(state));
  }, [state]);

  const goToNextStep = () => {
    triggerHaptic('light');
    analytics.trackEvent('onboarding_step_completed', { step: state.step });
    if (state.step < TOTAL_STEPS) {
      setState(prev => ({ ...prev, step: prev.step + 1 }));
    } else {
      handleFinalize();
    }
  };

  const goToPrevStep = () => {
    triggerHaptic('light');
    if (state.step > 1) {
      setState(prev => ({ ...prev, step: prev.step - 1 }));
    }
  };

  const handleFinalize = () => {
    triggerHaptic('medium');
    const finalized = { ...state, completed: true };
    localStorage.removeItem('extrovela_onboarding_temp_state');
    localStorage.setItem('extrovela_onboarding_completed', 'true');
    analytics.trackEvent('onboarding_completed');
    onComplete(finalized);
  };

  const toggleMultiSelect = (key: 'motivations' | 'interests' | 'dislikes', item: string) => {
    triggerHaptic('light');
    setState(prev => {
      const current = prev[key];
      const next = current.includes(item) ? current.filter(i => i !== item) : [...current, item];
      return { ...prev, [key]: next };
    });
  };

  // Progress Bar percentage
  const progressPercent = Math.round((state.step / TOTAL_STEPS) * 100);

  return (
    <div className="app-shell flex flex-col justify-between min-h-screen py-24 px-20 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="ambient-glow ambient-glow-top" />
      <div className="ambient-glow ambient-glow-bottom" />

      {/* Top Header & Progress */}
      <div className="container" style={{ maxWidth: 580 }}>
        <div className="flex items-center justify-between mb-16">
          {state.step > 1 ? (
            <button
              type="button"
              className="btn-ghost flex items-center gap-6 text-xs font-bold"
              onClick={goToPrevStep}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              <span>Back</span>
            </button>
          ) : (
            <img
              src={mode === 'light' ? '/logo-light.png' : '/logo-dark.png'}
              alt="EXTROVELA"
              style={{ height: 38, width: 'auto', objectFit: 'contain' }}
            />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="font-mono text-xs text-muted">
              Step {state.step} of {TOTAL_STEPS}
            </span>
            <button
              type="button"
              className="btn-ghost font-bold text-xs"
              style={{ color: 'var(--color-accent)', padding: '2px 8px' }}
              onClick={handleFinalize}
            >
              Skip & Do Later
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div style={{ height: 4, background: 'var(--color-surface)', borderRadius: 99, overflow: 'hidden', marginBottom: 32 }}>
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'var(--color-accent)',
              borderRadius: 99,
              transition: 'width var(--transition-normal)',
            }}
          />
        </div>
      </div>

      {/* Main Conversational Step Container */}
      <div className="container animate-slide-up flex-1 flex flex-col justify-center" style={{ maxWidth: 580, margin: '0 auto' }}>
        {/* STEP 1: Name */}
        {state.step === 1 && (
          <div>
            <Badge variant="brand" mono className="mb-12">STEP 1 • IDENTITY</Badge>
            <Heading variant="display" style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, marginBottom: 8 }}>
              What should we call you?
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 28 }}>
              Your name or preferred explorer moniker.
            </Text>

            <Input
              placeholder="e.g. Alex"
              value={state.name}
              onChange={e => setState(prev => ({ ...prev, name: e.target.value }))}
              autoFocus
            />
          </div>
        )}

        {/* STEP 2: Motivations */}
        {state.step === 2 && (
          <div>
            <Badge variant="brand" mono className="mb-12">STEP 2 • MOTIVATION</Badge>
            <Heading variant="display" style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 900, marginBottom: 8 }}>
              What made you open EXTROVELA?
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 24 }}>
              Select everything that resonates.
            </Text>

            <div className="flex flex-wrap gap-10">
              {[
                'I want to try new things',
                'I’m bored of my daily routine',
                'I want to explore my city',
                'I want more things to do alone',
                'I want to spend more time outside',
                'I want to make more memories',
                'I want to meet people',
                'I just want to see what happens',
              ].map(opt => (
                <Chip
                  key={opt}
                  selected={state.motivations.includes(opt)}
                  onClick={() => toggleMultiSelect('motivations', opt)}
                >
                  {opt}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Experience Style */}
        {state.step === 3 && (
          <div>
            <Badge variant="brand" mono className="mb-12">STEP 3 • STYLE</Badge>
            <Heading variant="display" style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 900, marginBottom: 8 }}>
              What sounds more like you?
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 24 }}>
              Tune your primary exploratory rhythm.
            </Text>

            <div className="flex flex-col gap-14">
              <Card style={{ padding: 18 }}>
                <span className="form-label mb-8">Adventure Pace</span>
                <div className="flex gap-8">
                  {[
                    { key: 'comfortable', label: 'Keep it comfortable' },
                    { key: 'stretch', label: 'Push me a little' },
                    { key: 'surprise', label: 'Surprise me' },
                  ].map(item => (
                    <Chip
                      key={item.key}
                      selected={state.adventureStyle.adventure === item.key}
                      onClick={() => setState(prev => ({ ...prev, adventureStyle: { ...prev.adventureStyle, adventure: item.key as any } }))}
                    >
                      {item.label}
                    </Chip>
                  ))}
                </div>
              </Card>

              <Card style={{ padding: 18 }}>
                <span className="form-label mb-8">Social Preference</span>
                <div className="flex gap-8">
                  {[
                    { key: 'solo', label: 'Mostly solo' },
                    { key: 'sometimes_social', label: 'Sometimes social' },
                    { key: 'bring_people', label: 'Bring people into it' },
                  ].map(item => (
                    <Chip
                      key={item.key}
                      selected={state.adventureStyle.social === item.key}
                      onClick={() => setState(prev => ({ ...prev, adventureStyle: { ...prev.adventureStyle, social: item.key as any } }))}
                    >
                      {item.label}
                    </Chip>
                  ))}
                </div>
              </Card>

              <Card style={{ padding: 18 }}>
                <span className="form-label mb-8">Environment</span>
                <div className="flex gap-8">
                  {[
                    { key: 'indoor', label: 'Mostly indoors' },
                    { key: 'outdoor', label: 'Mostly outdoors' },
                    { key: 'mix', label: 'A healthy mix' },
                  ].map(item => (
                    <Chip
                      key={item.key}
                      selected={state.adventureStyle.environment === item.key}
                      onClick={() => setState(prev => ({ ...prev, adventureStyle: { ...prev.adventureStyle, environment: item.key as any } }))}
                    >
                      {item.label}
                    </Chip>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* STEP 4: Adventure Level */}
        {state.step === 4 && (
          <div>
            <Badge variant="brand" mono className="mb-12">STEP 4 • ADVENTURE</Badge>
            <Heading variant="display" style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 900, marginBottom: 8 }}>
              How far outside your routine?
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 24 }}>
              Choose your baseline comfort boundary.
            </Text>

            <div className="grid-2" style={{ gap: 14 }}>
              {[
                { key: 'Comfort', title: 'Comfort', desc: 'Keep it easy and peaceful.' },
                { key: 'Stretch', title: 'Stretch', desc: 'Something a little different from the norm.' },
                { key: 'Adventure', title: 'Adventure', desc: 'Take me somewhere completely new.' },
                { key: 'Wild Card', title: 'Wild Card', desc: 'Full spontaneous surprise.' },
              ].map(lvl => (
                <Card
                  key={lvl.key}
                  interactive
                  onClick={() => setState(prev => ({ ...prev, adventureLevel: lvl.key as any }))}
                  style={{
                    padding: 20,
                    cursor: 'pointer',
                    borderColor: state.adventureLevel === lvl.key ? 'var(--color-border-accent)' : 'var(--color-border)',
                  }}
                >
                  <span className="font-display font-bold text-base block mb-4">{lvl.title}</span>
                  <Text variant="bodySM" color="secondary">{lvl.desc}</Text>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: Social Preference */}
        {state.step === 5 && (
          <div>
            <Badge variant="brand" mono className="mb-12">STEP 5 • SOCIAL MODE</Badge>
            <Heading variant="display" style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 900, marginBottom: 8 }}>
              How do you want to experience things?
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 24 }}>
              You can always adjust this per quest later.
            </Text>

            <div className="flex flex-col gap-10">
              {[
                { key: 'solo', label: 'Solo (Mindful, quiet, self-paced)' },
                { key: 'friends', label: 'With friends / partner' },
                { key: 'meet_people', label: 'Open to meeting new people' },
                { key: 'flexible', label: 'Depends on the day' },
              ].map(item => (
                <Card
                  key={item.key}
                  interactive
                  onClick={() => setState(prev => ({ ...prev, socialPreference: item.key as any }))}
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    borderColor: state.socialPreference === item.key ? 'var(--color-border-accent)' : 'var(--color-border)',
                  }}
                >
                  <span className="font-sans font-bold text-sm">{item.label}</span>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* STEP 6: Interests */}
        {state.step === 6 && (
          <div>
            <Badge variant="brand" mono className="mb-12">STEP 6 • INTERESTS</Badge>
            <Heading variant="display" style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 900, marginBottom: 8 }}>
              What experiences pull you in?
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 24 }}>
              Select as many as you like.
            </Text>

            <div className="flex flex-wrap gap-10">
              {[
                'Nature & Hillsides',
                'Street Food & Teahouses',
                'Ancient Courtyards & Heritage',
                'Street Photography',
                'Analog Books & Reading',
                'Live Music & Acoustic',
                'Quiet Sanctuary Corners',
                'Local Alley Discoveries',
                'Creative Art & Craft',
                'Outdoor Movement & Walks',
              ].map(opt => (
                <Chip
                  key={opt}
                  selected={state.interests.includes(opt)}
                  onClick={() => toggleMultiSelect('interests', opt)}
                >
                  {opt}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* STEP 7: Dislikes */}
        {state.step === 7 && (
          <div>
            <Badge variant="brand" mono className="mb-12">STEP 7 • AVOIDANCES</Badge>
            <Heading variant="display" style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 900, marginBottom: 8 }}>
              Anything you’d rather avoid?
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 24 }}>
              We will actively filter these out of your quests.
            </Text>

            <div className="flex flex-wrap gap-10">
              {[
                'Crowds & Packed Spaces',
                'Long Travel & Commute',
                'Expensive Activities',
                'Loud Places & Noise',
                'Heavy Physical Straining',
                'Late Nights',
                'Large Social Gatherings',
                'Nothing in particular',
              ].map(opt => (
                <Chip
                  key={opt}
                  selected={state.dislikes.includes(opt)}
                  onClick={() => toggleMultiSelect('dislikes', opt)}
                >
                  {opt}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* STEP 8: Available Time */}
        {state.step === 8 && (
          <div>
            <Badge variant="brand" mono className="mb-12">STEP 8 • TIME</Badge>
            <Heading variant="display" style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 900, marginBottom: 8 }}>
              How much time do you usually have?
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 24 }}>
              Your typical window for a daily escape.
            </Text>

            <div className="grid-2" style={{ gap: 12 }}>
              {[
                '10–20 mins (Micro Escape)',
                '30 mins',
                '1 hour',
                '2 hours',
                'Half day',
                'Depends on the day',
              ].map(time => (
                <Chip
                  key={time}
                  selected={state.typicalAvailableTime === time}
                  onClick={() => setState(prev => ({ ...prev, typicalAvailableTime: time }))}
                >
                  {time}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* STEP 9: Budget */}
        {state.step === 9 && (
          <div>
            <Badge variant="brand" mono className="mb-12">STEP 9 • BUDGET</Badge>
            <Heading variant="display" style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 900, marginBottom: 8 }}>
              Typical adventure budget?
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 24 }}>
              Neutral and low-friction options.
            </Text>

            <div className="flex flex-col gap-10">
              {[
                'Free (Zero cost)',
                'Under NPR 300 (Tea, bus ticket, small treat)',
                'NPR 300–1,000 (Café, museum entry, shared snack)',
                'NPR 1,000–3,000 (Special outing)',
                'Flexible',
              ].map(b => (
                <Chip
                  key={b}
                  selected={state.budgetRange === b}
                  onClick={() => setState(prev => ({ ...prev, budgetRange: b }))}
                >
                  {b}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* STEP 10: Energy Level */}
        {state.step === 10 && (
          <div>
            <Badge variant="brand" mono className="mb-12">STEP 10 • ENERGY</Badge>
            <Heading variant="display" style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 900, marginBottom: 8 }}>
              How much energy do you want to spend?
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 24 }}>
              A mood baseline for everyday recommendations.
            </Text>

            <div className="grid-2" style={{ gap: 12 }}>
              {[
                { key: 'Chill', title: 'Low / Chill', desc: 'Keep it calm and restful.' },
                { key: 'Moderate', title: 'Moderate', desc: 'A nice brisk stroll or discovery.' },
                { key: 'High Energy', title: 'High Energy', desc: 'Active walking, uphill, or cycling.' },
              ].map(e => (
                <Card
                  key={e.key}
                  interactive
                  onClick={() => setState(prev => ({ ...prev, energyPreference: e.key as any }))}
                  style={{
                    padding: 18,
                    cursor: 'pointer',
                    borderColor: state.energyPreference === e.key ? 'var(--color-border-accent)' : 'var(--color-border)',
                  }}
                >
                  <span className="font-display font-bold text-sm block mb-2">{e.title}</span>
                  <Text variant="bodySM" color="muted">{e.desc}</Text>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* STEP 11: Location Permission Handshake */}
        {state.step === 11 && (
          <div>
            <Badge variant="brand" mono className="mb-12">STEP 11 • CONTEXTUAL LOCATION</Badge>
            <Heading variant="display" style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 900, marginBottom: 8 }}>
              Experience the world near you.
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 24, lineHeight: 1.65 }}>
              EXTROVELA uses your approximate location to calculate nearby viewpoints, secret alleys, and local sunset times. We never track continuous GPS history or share your location.
            </Text>

            <Card style={{ padding: 24, marginBottom: 20 }}>
              <div className="flex items-center gap-14 mb-12">
                <MapPin style={{ width: 24, height: 24, color: 'var(--color-accent)' }} />
                <div>
                  <span className="font-display font-bold text-sm block">Location Access</span>
                  <Text variant="bodySM" color="muted">Used solely when discovering nearby quests.</Text>
                </div>
              </div>

              <div className="flex gap-10">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    analytics.trackEvent('location_permission_granted');
                    setState(prev => ({ ...prev, locationPermissionStatus: 'granted' }));
                    goToNextStep();
                  }}
                >
                  <span>Allow Location</span>
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    analytics.trackEvent('location_permission_denied');
                    setState(prev => ({ ...prev, locationPermissionStatus: 'denied' }));
                    goToNextStep();
                  }}
                >
                  <span>Not Now</span>
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* STEP 12: Notification Permission Handshake */}
        {state.step === 12 && (
          <div>
            <Badge variant="brand" mono className="mb-12">STEP 12 • SMART MOMENTS</Badge>
            <Heading variant="display" style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 900, marginBottom: 8 }}>
              Catch the right moment.
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 24, lineHeight: 1.65 }}>
              Receive subtle invitations when golden hour begins, unexpected rain clears, or a restful weekend morning opens up.
            </Text>

            <Card style={{ padding: 24, marginBottom: 20 }}>
              <div className="flex items-center gap-14 mb-12">
                <Bell style={{ width: 24, height: 24, color: 'var(--color-accent)' }} />
                <div>
                  <span className="font-display font-bold text-sm block">Experience Reminders</span>
                  <Text variant="bodySM" color="muted">Only 1 thoughtful drop per day.</Text>
                </div>
              </div>

              <div className="flex gap-10">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    analytics.trackEvent('notification_permission_granted');
                    setState(prev => ({ ...prev, notificationPermissionStatus: 'granted' }));
                    goToNextStep();
                  }}
                >
                  <span>Enable Notifications</span>
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    analytics.trackEvent('notification_permission_denied');
                    setState(prev => ({ ...prev, notificationPermissionStatus: 'denied' }));
                    goToNextStep();
                  }}
                >
                  <span>Not Now</span>
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* STEP 13: Personalization Profile Summary */}
        {state.step === 13 && (
          <div>
            <Badge variant="brand" mono className="mb-12">STEP 13 • COMPLETE</Badge>
            <Heading variant="display" style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, marginBottom: 8 }}>
              Looks like you’re ready, {state.name || 'Explorer'}.
            </Heading>
            <Text variant="bodyMD" color="secondary" style={{ marginBottom: 24 }}>
              Here is your initial experience profile summary:
            </Text>

            <Card style={{ padding: 24, marginBottom: 24 }}>
              <div className="flex items-center justify-between border-bottom pb-12 mb-14">
                <span className="font-mono text-xs text-accent font-bold uppercase">ARCHETYPE</span>
                <Badge variant="brand" mono>The Mindful Trailblazer</Badge>
              </div>

              <div className="flex flex-col gap-8 text-xs font-mono text-secondary">
                <div>• Mode: {state.socialPreference} • Adventure: {state.adventureLevel}</div>
                <div>• Typical window: {state.typicalAvailableTime} • {state.budgetRange}</div>
                <div>• Energy: {state.energyPreference}</div>
                {state.interests.length > 0 && (
                  <div className="mt-4 pt-8 border-top text-muted">
                    Interests: {state.interests.slice(0, 3).join(', ')}...
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="container pt-20" style={{ maxWidth: 580 }}>
        {state.step < 11 || state.step === 13 ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={goToNextStep}
            disabled={state.step === 1 && !state.name.trim()}
            rightIcon={<ArrowRight style={{ width: 16, height: 16 }} />}
          >
            <span>{state.step === 13 ? 'CREATE MY EXPERIENCE PROFILE' : 'Continue'}</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
};
