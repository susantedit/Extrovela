import React, { useState, useEffect } from 'react';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar, TabId } from './components/Navbar';
import { HomeScreen } from './components/screens/HomeScreen';
import { ExploreScreen } from './components/screens/ExploreScreen';
import { MapScreen } from './components/screens/MapScreen';
import { MemoriesScreen } from './components/screens/MemoriesScreen';
import { FriendsScreen } from './components/screens/FriendsScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { WelcomeScreen } from './components/auth/WelcomeScreen';
import { SignInScreen } from './components/auth/SignInScreen';
import { SignUpScreen } from './components/auth/SignUpScreen';
import { ForgotPasswordModal } from './components/auth/ForgotPasswordModal';
import { AccountLinkingModal } from './components/auth/AccountLinkingModal';
import { OnboardingFlow } from './features/onboarding/OnboardingFlow';
import { ActiveQuestCard } from './components/ActiveQuestCard';
import { CaptureModal } from './components/CaptureModal';
import { PrivacyTermsModal } from './components/PrivacyTermsModal';
import { AdminMetricsModal } from './components/AdminMetricsModal';
import { NotificationInboxModal } from './features/notifications/NotificationInboxModal';
import { AmbientSoundPlayer } from './components/AmbientSoundPlayer';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { LoadingState } from './components/primitives';
import { Quest } from './types';
import { OnboardingState } from './types/onboarding';
import { experienceIntelligenceService } from './services/intelligence/experienceIntelligenceService';
import './styles/index.css';

type AuthView = 'welcome' | 'sign-in' | 'sign-up';

const ProtectedAppRouter: React.FC = () => {
  const { status, user, isLoading: isAuthLoading } = useAuth();
  const [authView, setAuthView] = useState<AuthView>('welcome');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);

  // Track whether onboarding has been completed for this session
  const [isOnboardingDone, setIsOnboardingDone] = useState<boolean>(() => {
    return localStorage.getItem('extrovela_onboarding_completed') === 'true';
  });

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const { activeQuest, setActiveQuest } = useAppState();

  const handleStartQuest = (quest: Quest) => {
    setActiveQuest(quest);

    // Phase 11 — record the accept+start interaction against the authenticated
    // user. Choosing a quest to run is both the acceptance signal (this
    // category/type is wanted) and the start signal (committed to doing it).
    // Fire-and-forget so personalization never blocks the UI transition.
    const uid = user?.uid;
    if (uid) {
      void experienceIntelligenceService.recordQuestAccepted(uid, quest).catch(() => {});
      void experienceIntelligenceService.recordQuestStarted(uid, quest).catch(() => {});
    }
  };

  const handleWipeData = () => {
    localStorage.clear();
    window.location.reload();
  };

  const handleOnboardingComplete = (completedState: OnboardingState) => {
    setIsOnboardingDone(true);
  };

  // 1. Initializing / Splash Loading State
  if (isAuthLoading || status === 'INITIALIZING') {
    return (
      <div className="app-shell flex items-center justify-center min-h-screen">
        <LoadingState message="Awakening EXTROVELA…" />
      </div>
    );
  }

  // 2. Unauthenticated / Signed Out State -> Public Auth Screens
  if (status === 'SIGNED_OUT') {
    return (
      <>
        {authView === 'welcome' && (
          <WelcomeScreen
            onNavigateSignIn={() => setAuthView('sign-in')}
            onNavigateSignUp={() => setAuthView('sign-up')}
          />
        )}
        {authView === 'sign-in' && (
          <SignInScreen
            onBack={() => setAuthView('welcome')}
            onNavigateSignUp={() => setAuthView('sign-up')}
            onForgotPassword={() => setIsForgotPasswordOpen(true)}
          />
        )}
        {authView === 'sign-up' && (
          <SignUpScreen
            onBack={() => setAuthView('welcome')}
            onNavigateSignIn={() => setAuthView('sign-in')}
          />
        )}

        <ForgotPasswordModal
          isOpen={isForgotPasswordOpen}
          onClose={() => setIsForgotPasswordOpen(false)}
        />
      </>
    );
  }

  // 3. Authenticated (Guest or Signed In) but Onboarding Incomplete
  if (!isOnboardingDone) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  // 4. Authenticated & Onboarding Complete -> Protected Application Shell
  return (
    <div className="app-shell">
      {/* Ambient Atmospheric Glows */}
      <div className="ambient-glow ambient-glow-top animate-pulse-glow" />
      <div className="ambient-glow ambient-glow-bottom" />

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPrivacy={() => setIsPrivacyModalOpen(true)}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        onOpenInbox={() => setIsInboxOpen(true)}
      />

      {/* Guest Account Linking Banner if in Guest Mode */}
      {status === 'GUEST' && (
        <div
          style={{
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border-accent)',
            padding: '8px 20px',
            textAlign: 'center',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <span className="font-mono text-muted">Exploring as Guest.</span>
          <button
            type="button"
            className="btn-ghost font-bold text-accent"
            onClick={() => setIsLinkingModalOpen(true)}
            style={{ padding: 0, textDecoration: 'underline' }}
          >
            Save progress to permanent account →
          </button>
        </div>
      )}

      {/* Active Quest Banner Floating Overlay if an active quest is running */}
      {activeQuest && (
        <div className="container" style={{ paddingTop: 16 }}>
          <ActiveQuestCard onComplete={() => setIsCaptureModalOpen(true)} />
        </div>
      )}

      {/* Main Screen Router */}
      <main className="app-main">
        {activeTab === 'home' && (
          <HomeScreen
            onNavigateTab={tab => setActiveTab(tab)}
            onStartQuest={handleStartQuest}
          />
        )}
        {activeTab === 'explore' && (
          <ExploreScreen onStartQuest={handleStartQuest} />
        )}
        {activeTab === 'map' && <MapScreen />}
        {activeTab === 'memories' && <MemoriesScreen />}
        {activeTab === 'friends' && <FriendsScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </main>

      {/* Capture Modal */}
      <CaptureModal
        isOpen={isCaptureModalOpen}
        onClose={() => setIsCaptureModalOpen(false)}
        onSaved={() => {
          setIsCaptureModalOpen(false);
          setActiveTab('memories');
        }}
      />

      {/* Privacy, Terms & Data Reset Modal */}
      <PrivacyTermsModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        onWipeData={handleWipeData}
      />

      {/* Admin Observability Dashboard Modal */}
      <AdminMetricsModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />

      {/* Opportunities & Notifications Inbox Modal */}
      <NotificationInboxModal
        isOpen={isInboxOpen}
        onClose={() => setIsInboxOpen(false)}
      />

      {/* Account Linking Modal */}
      <AccountLinkingModal
        isOpen={isLinkingModalOpen}
        onClose={() => setIsLinkingModalOpen(false)}
      />

      {/* Ambient Procedural Soundscape Player */}
      <AmbientSoundPlayer />

      {/* One-Tap PWA Installation Prompt Banner */}
      <PWAInstallPrompt />
    </div>
  );
};

import { CustomAlertProvider } from './context/CustomAlertContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppStateProvider>
          <CustomAlertProvider>
            <ProtectedAppRouter />
          </CustomAlertProvider>
        </AppStateProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
