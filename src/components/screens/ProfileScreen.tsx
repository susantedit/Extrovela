import React, { useState } from 'react';
import { Compass, Footprints, Heart, MapPin, Sparkles, Sun, Users, Flame, Award, Sliders, Moon, Bell, LogOut, Trash2, ShieldCheck, RefreshCw, UserCheck, KeyRound } from 'lucide-react';
import { Card, Button, Badge, Heading, Text, SectionHeader } from '../primitives';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import { triggerHaptic } from '../../lib/native-device';
import { NotificationSettingsModal } from '../../features/notifications';
import { PersonalizationSettingsScreen } from '../../features/personalization';
import { AccountLinkingModal } from '../auth/AccountLinkingModal';
import { useCustomAlert } from '../../context/CustomAlertContext';

export const ProfileScreen: React.FC = () => {
  const { mode, toggleTheme } = useTheme();
  const { user, status, signOut, deleteAccount } = useAuth();
  const { stats, city } = useAppState();
  const { showAlert, showConfirm, showToast } = useCustomAlert();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    const confirmed = await showConfirm({
      title: 'Sign Out of EXTROVELA',
      message: 'Are you sure you want to end your current session? You can sign back in anytime.',
      confirmText: 'Sign Out',
      cancelText: 'Stay',
      type: 'warning',
    });

    if (confirmed) {
      setIsLoggingOut(true);
      try {
        await signOut();
        showToast({ message: 'Signed out successfully.', type: 'info' });
      } finally {
        setIsLoggingOut(false);
      }
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = await showConfirm({
      title: 'Delete Account & Memories',
      message: 'WARNING: Are you sure you want to permanently delete your EXTROVELA account and all saved memories? This action cannot be undone.',
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      destructive: true,
    });

    if (confirmed) {
      try {
        await deleteAccount();
        showToast({ message: 'Account deleted.', type: 'info' });
      } catch (err: any) {
        showAlert({
          title: 'Account Deletion Error',
          message: err?.message || 'Failed to delete account.',
          type: 'error',
        });
      }
    }
  };

  const handleResetData = async () => {
    const confirmed = await showConfirm({
      title: 'Clear Local App Cache',
      message: 'This will reset temporary cached data and reload the app fresh. Proceed?',
      confirmText: 'Clear Cache',
      cancelText: 'Cancel',
      type: 'warning',
    });

    if (confirmed) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="container py-32 screen-enter" style={{ maxWidth: 880 }}>
      {/* Header Profile Card */}
      <Card className="mb-32" style={{ padding: 'clamp(24px, 5vw, 40px)' }}>
        <div className="flex items-center justify-between border-bottom pb-20 mb-24" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div className="flex items-center gap-16">
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-primary)',
                border: '2px solid var(--color-accent)',
                boxShadow: '0 0 24px var(--color-accent-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-accent)',
              }}
            >
              <Compass style={{ width: 32, height: 32 }} />
            </div>

            <div>
              <Badge variant="brand" mono className="mb-4">{stats.explorerArchetype || 'Urban Flâneur'}</Badge>
              <Heading variant="headingLG" style={{ fontSize: 24, fontWeight: 900 }}>
                {user?.displayName || 'Explorer Profile'}
              </Heading>
              <Text variant="bodySM" color="muted">
                {stats.totalQuestsCompleted || 0} real-world experiences logged across {city}
              </Text>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {/* Personalization Settings Button */}
            <Button
              variant="glass"
              size="sm"
              onClick={() => {
                triggerHaptic('light');
                setIsPersonalizationOpen(true);
              }}
              leftIcon={<Sliders style={{ width: 14, height: 14 }} />}
            >
              <span>Personalization</span>
            </Button>

            {/* Notification Settings Button */}
            <Button
              variant="glass"
              size="sm"
              onClick={() => {
                triggerHaptic('light');
                setIsSettingsOpen(true);
              }}
              leftIcon={<Bell style={{ width: 14, height: 14 }} />}
            >
              <span>Notifications</span>
            </Button>

            {/* Theme Toggle Button */}
            <Button
              variant="glass"
              size="sm"
              onClick={() => {
                triggerHaptic('light');
                toggleTheme();
              }}
              leftIcon={mode === 'light' ? <Moon style={{ width: 14, height: 14 }} /> : <Sun style={{ width: 14, height: 14 }} />}
            >
              <span>{mode === 'light' ? 'Dark Mode' : 'Natural Light'}</span>
            </Button>
          </div>
        </div>

        {/* 4-Stat Milestone Grid */}
        <div className="grid-4 mb-24">
          <div className="stat-card">
            <MapPin style={{ width: 18, height: 18, color: 'var(--color-accent)', marginBottom: 8 }} />
            <div className="stat-value text-accent">{stats.uniqueLocationsVisited || 0}</div>
            <div className="stat-label">Places Visited</div>
          </div>

          <div className="stat-card">
            <Award style={{ width: 18, height: 18, color: 'var(--color-secondary)', marginBottom: 8 }} />
            <div className="stat-value text-brand">{stats.firstTimeCount || 0}</div>
            <div className="stat-label">First Times</div>
          </div>

          <div className="stat-card">
            <Heart style={{ width: 18, height: 18, color: 'var(--color-accent)', marginBottom: 8 }} />
            <div className="stat-value text-accent">{stats.totalQuestsCompleted || 0}</div>
            <div className="stat-label">Memories</div>
          </div>

          <div className="stat-card">
            <Flame style={{ width: 18, height: 18, color: 'var(--color-warning)', marginBottom: 8 }} />
            <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{stats.routineBreakerStreak || 1}d</div>
            <div className="stat-label">Streak</div>
          </div>
        </div>

        {/* Behavioral Experience Ratios */}
        <div className="grid-2" style={{ gap: 16 }}>
          {/* Outdoor vs Indoor */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-8">
              <span className="form-label" style={{ marginBottom: 0 }}>
                <Sun style={{ width: 14, height: 14, color: 'var(--color-accent)' }} /> Environment Ratio
              </span>
              <span className="font-mono text-xs text-accent font-bold">{stats.outdoorPercentage || 70}% Outdoor</span>
            </div>
            <div style={{ height: 8, background: 'var(--color-surface-elevated)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${stats.outdoorPercentage || 70}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 99 }} />
            </div>
            <div className="flex justify-between text-xs text-muted mt-8 font-mono">
              <span>Indoor ({100 - (stats.outdoorPercentage || 70)}%)</span>
              <span>Outdoor ({stats.outdoorPercentage || 70}%)</span>
            </div>
          </div>

          {/* Solo vs Social */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-8">
              <span className="form-label" style={{ marginBottom: 0 }}>
                <Users style={{ width: 14, height: 14, color: 'var(--color-secondary)' }} /> Social Mode
              </span>
              <span className="font-mono text-xs text-brand font-bold">{stats.soloPercentage || 85}% Solo</span>
            </div>
            <div style={{ height: 8, background: 'var(--color-surface-elevated)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${stats.soloPercentage || 85}%`, height: '100%', background: 'var(--color-secondary)', borderRadius: 99 }} />
            </div>
            <div className="flex justify-between text-xs text-muted mt-8 font-mono">
              <span>Solo ({stats.soloPercentage || 85}%)</span>
              <span>Social ({100 - (stats.soloPercentage || 85)}%)</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Account Management & Security Card */}
      <Card className="mb-32" style={{ padding: 24 }}>
        <SectionHeader
          title="Account & Security"
          subtitle="Manage your session, authentication, and data privacy"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Identity & Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderRadius: 14,
              backgroundColor: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ShieldCheck style={{ width: 22, height: 22, color: 'var(--color-accent)' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                  {user?.email || (user?.isAnonymous ? 'Guest Explorer (Unlinked)' : user?.displayName || 'Active Account')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                  UID: {user?.uid || 'local_session'}
                </div>
              </div>
            </div>

            <Badge variant={user?.isAnonymous ? 'accent' : 'brand'} mono>
              {user?.isAnonymous ? 'GUEST MODE' : 'PERMANENT'}
            </Badge>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {/* Link Account Button (if Guest) */}
            {user?.isAnonymous && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  triggerHaptic('light');
                  setIsLinkingModalOpen(true);
                }}
                style={{ justifyContent: 'center', fontSize: 13 }}
              >
                <KeyRound size={16} />
                <span>Link Permanent Account</span>
              </button>
            )}

            {/* Log Out Button */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              style={{
                justifyContent: 'center',
                fontSize: 13,
                color: '#EF4444',
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
            >
              <LogOut size={16} />
              <span>{isLoggingOut ? 'Signing out...' : 'Log Out / Sign Out'}</span>
            </button>

            {/* Reset App Data */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetData}
              style={{ justifyContent: 'center', fontSize: 13 }}
            >
              <RefreshCw size={16} />
              <span>Clear App Cache</span>
            </button>

            {/* Delete Account Button */}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleDeleteAccount}
              style={{
                justifyContent: 'center',
                fontSize: 12,
                color: 'var(--color-text-muted)',
              }}
            >
              <Trash2 size={14} />
              <span>Delete Account & Data</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Experience Principles Card */}
      <Card style={{ padding: 24 }}>
        <SectionHeader title="Your Experience Philosophy" subtitle="Guiding your real-world rhythm" />
        <div className="flex flex-wrap gap-8">
          <Badge variant="brand" mono>✓ Break Daily Routine</Badge>
          <Badge variant="brand" mono>✓ Mindful Outdoor Time</Badge>
          <Badge variant="brand" mono>✓ Analog Sanctuary Reading</Badge>
          <Badge variant="brand" mono>✓ Hidden Courtyards</Badge>
        </div>
      </Card>

      {/* Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Account Linking Modal */}
      <AccountLinkingModal
        isOpen={isLinkingModalOpen}
        onClose={() => setIsLinkingModalOpen(false)}
      />

      {/* Personalization Settings — full-screen overlay */}
      {isPersonalizationOpen && user?.uid && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Personalization settings"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'var(--color-bg)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <PersonalizationSettingsScreen
            userId={user.uid}
            onClose={() => setIsPersonalizationOpen(false)}
          />
        </div>
      )}
    </div>
  );
};
