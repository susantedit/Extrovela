import React from 'react';
import { Home, Compass, MapPin, BookOpen, Users, User, Sun, Moon, ShieldCheck, Activity, Bell } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../lib/native-device';

export type TabId = 'home' | 'explore' | 'map' | 'memories' | 'friends' | 'profile';

interface NavbarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  onOpenPrivacy: () => void;
  onOpenAdmin: () => void;
  onOpenInbox?: () => void;
}

const TABS: { id: TabId; label: string; mobileLabel: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Home', mobileLabel: 'Home', icon: Home },
  { id: 'explore', label: 'Explore', mobileLabel: 'Explore', icon: Compass },
  { id: 'map', label: 'Life Map', mobileLabel: 'Map', icon: MapPin },
  { id: 'memories', label: 'Memories', mobileLabel: 'Memories', icon: BookOpen },
  { id: 'friends', label: 'Companions', mobileLabel: 'Friends', icon: Users },
  { id: 'profile', label: 'Profile', mobileLabel: 'Profile', icon: User },
];

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenPrivacy, onOpenAdmin, onOpenInbox }) => {
  const { mode, toggleTheme } = useTheme();

  return (
    <>
      {/* Desktop Header */}
      <header className="navbar">
        <div className="navbar-inner">
          {/* Brand Logo (Theme-aware: Light vs Dark) */}
          <div className="navbar-logo" onClick={() => setActiveTab('home')}>
            <img src={mode === 'light' ? '/logo-light.png' : '/logo-dark.png'} alt="EXTROVELA" />
          </div>

          {/* Desktop Navigation */}
          <nav className="nav-desktop">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`nav-tab ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveTab(tab.id);
                  }}
                >
                  <Icon style={{ width: 16, height: 16 }} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="navbar-controls">
            {/* Opportunities Inbox */}
            {onOpenInbox && (
              <button
                className="btn-icon"
                onClick={() => {
                  triggerHaptic('light');
                  onOpenInbox();
                }}
                title="Opportunities Inbox"
              >
                <Bell style={{ width: 16, height: 16, color: 'var(--color-accent)' }} />
              </button>
            )}

            {/* Theme Toggle (Natural Light <-> Dark Forest) */}
            <button
              className="btn-icon"
              onClick={() => {
                triggerHaptic('light');
                toggleTheme();
              }}
              title={mode === 'light' ? 'Switch to Dark Forest' : 'Switch to Natural Light'}
            >
              {mode === 'light' ? (
                <Moon style={{ width: 16, height: 16, color: 'var(--color-secondary)' }} />
              ) : (
                <Sun style={{ width: 16, height: 16, color: 'var(--color-accent)' }} />
              )}
            </button>

            {/* Admin Observability Dashboard */}
            <button
              className="btn-icon"
              onClick={() => {
                triggerHaptic('light');
                onOpenAdmin();
              }}
              title="Admin Observability Dashboard"
            >
              <Activity style={{ width: 16, height: 16, color: 'var(--color-secondary)' }} />
            </button>

            {/* Privacy & Legal */}
            <button
              className="btn-icon"
              onClick={() => {
                triggerHaptic('light');
                onOpenPrivacy();
              }}
              title="Privacy & Legal"
            >
              <ShieldCheck style={{ width: 16, height: 16, color: 'var(--color-secondary)' }} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Integrated Bottom Navigation (Max 5 items for accessible touch targets) */}
      <nav className="nav-mobile">
        {TABS.filter(tab => tab.id !== 'friends').map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`nav-mobile-tab ${isActive ? 'active' : ''}`}
              onClick={() => {
                triggerHaptic('light');
                setActiveTab(tab.id);
              }}
            >
              <Icon />
              <span>{tab.mobileLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
