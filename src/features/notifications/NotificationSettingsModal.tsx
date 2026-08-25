import React, { useState, useEffect } from 'react';
import { Sliders, Moon, Bell, ShieldCheck, X, Check, PauseCircle } from 'lucide-react';
import { NotificationPreferences } from '../../types/notification';
import { DailyQuestService } from '../../services/notifications/dailyQuestService';
import { NotificationBudgetService } from '../../services/notifications/notificationBudgetService';
import { Card, Button, Badge, Heading, Text, Input } from '../../components/primitives';
import { haptics } from '../../utils/haptics';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    dailyQuestEnabled: true,
    weatherOpportunitiesEnabled: true,
    questRemindersEnabled: true,
    groupQuestEnabled: true,
    friendActivityEnabled: true,
    memoryRemindersEnabled: false,
    weeklyRecapEnabled: true,
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    maxDailyNotifications: 2,
    isPaused: false,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      DailyQuestService.getPreferences('user_active').then(setPrefs);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleField = (field: keyof NotificationPreferences) => {
    haptics.selection();
    setPrefs(prev => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSave = async () => {
    haptics.success();
    await DailyQuestService.updatePreferences('user_active', prefs);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handlePause = (days: number) => {
    haptics.medium();
    const paused = NotificationBudgetService.createPausedPreferences(days, prefs);
    setPrefs(paused);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(23, 24, 19, 0.95)',
        backdropFilter: 'blur(20px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 500,
          backgroundColor: '#22231D',
          border: '1px solid rgba(201, 154, 69, 0.3)',
          borderRadius: 24,
          padding: 24,
          color: '#F6F1E7',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={20} style={{ color: '#C99A45' }} />
            <Badge variant="brand" mono>NOTIFICATION PREFERENCES</Badge>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.6)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <Heading variant="headingLG" style={{ fontFamily: 'serif', marginBottom: 4 }}>
          Delivery Controls
        </Heading>
        <Text variant="bodySM" color="secondary" style={{ marginBottom: 16 }}>
          Adjust your frequency caps, quiet hours, and experience categories.
        </Text>

        {/* Content Body */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
          {/* Pause All */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Pause Notifications</div>
              <Badge variant={prefs.isPaused ? 'accent' : 'brand'} mono>
                {prefs.isPaused ? 'PAUSED' : 'ACTIVE'}
              </Badge>
            </div>
            <Text variant="bodySM" color="secondary" style={{ fontSize: 12, marginBottom: 10 }}>
              Temporarily silence all EXTROVELA notifications without changing your category settings.
            </Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="glass" size="sm" onClick={() => handlePause(1)} style={{ flex: 1 }}>
                Pause 1 Day
              </Button>
              <Button variant="glass" size="sm" onClick={() => handlePause(7)} style={{ flex: 1 }}>
                Pause 1 Week
              </Button>
              {prefs.isPaused && (
                <Button variant="primary" size="sm" onClick={() => setPrefs(prev => ({ ...prev, isPaused: false }))} style={{ flex: 1 }}>
                  Resume
                </Button>
              )}
            </div>
          </div>

          {/* Quiet Hours */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Moon size={16} style={{ color: '#C99A45' }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Quiet Hours</span>
              </div>
              <input
                type="checkbox"
                checked={prefs.quietHoursEnabled}
                onChange={() => toggleField('quietHoursEnabled')}
                style={{ width: 18, height: 18, accentColor: '#C99A45', cursor: 'pointer' }}
              />
            </div>
            {prefs.quietHoursEnabled && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <Text variant="caption" style={{ color: 'rgba(246,241,231,0.6)', marginBottom: 4, display: 'block' }}>START TIME</Text>
                  <Input
                    type="time"
                    value={prefs.quietHoursStart}
                    onChange={e => setPrefs(prev => ({ ...prev, quietHoursStart: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Text variant="caption" style={{ color: 'rgba(246,241,231,0.6)', marginBottom: 4, display: 'block' }}>END TIME</Text>
                  <Input
                    type="time"
                    value={prefs.quietHoursEnd}
                    onChange={e => setPrefs(prev => ({ ...prev, quietHoursEnd: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Max Daily Limit */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Max Daily Notifications</span>
              <span style={{ fontWeight: 700, color: '#C99A45' }}>{prefs.maxDailyNotifications} / day</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={prefs.maxDailyNotifications}
              onChange={e => setPrefs(prev => ({ ...prev, maxDailyNotifications: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: '#C99A45', cursor: 'pointer' }}
            />
          </div>

          {/* Categories */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Text variant="label" style={{ color: '#C99A45', marginBottom: 2, display: 'block' }}>CATEGORIES</Text>
            {[
              { key: 'dailyQuestEnabled', label: 'Daily Possibility Quests' },
              { key: 'weatherOpportunitiesEnabled', label: 'Weather Opportunities (Sunset, Clear Skies)' },
              { key: 'questRemindersEnabled', label: 'Gentle Quest Reminders' },
              { key: 'groupQuestEnabled', label: 'Group Companion Invitations' },
              { key: 'friendActivityEnabled', label: 'Friend Activity Updates' },
              { key: 'weeklyRecapEnabled', label: 'Weekly Story Recaps' },
            ].map(cat => (
              <div
                key={cat.key}
                onClick={() => toggleField(cat.key as keyof NotificationPreferences)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 13, color: '#F6F1E7' }}>{cat.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(prefs[cat.key as keyof NotificationPreferences])}
                  onChange={() => {}}
                  style={{ width: 16, height: 16, accentColor: '#C99A45' }}
                />
              </div>
            ))}
          </div>
        </div>

        {savedSuccess ? (
          <div style={{ padding: 12, backgroundColor: 'rgba(132, 204, 22, 0.15)', border: '1px solid #84CC16', borderRadius: 12, textAlign: 'center', color: '#84CC16', fontSize: 13, marginTop: 16 }}>
            Preferences saved successfully.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>
              CANCEL
            </Button>
            <Button variant="primary" onClick={handleSave} style={{ flex: 2 }}>
              SAVE PREFERENCES
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default NotificationSettingsModal;
