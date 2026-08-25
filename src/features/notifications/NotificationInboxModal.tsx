import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, X, Compass, Sun, Users, Bookmark } from 'lucide-react';
import { AppNotification } from '../../types/notification';
import { DailyQuestService } from '../../services/notifications/dailyQuestService';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, Heading, Text } from '../../components/primitives';
import { haptics } from '../../utils/haptics';

import { notificationManager } from '../../services/notifications/notificationManager';

interface NotificationInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateDeepLink?: (link: string) => void;
}

export const NotificationInboxModal: React.FC<NotificationInboxModalProps> = ({
  isOpen,
  onClose,
  onNavigateDeepLink,
}) => {
  const { user } = useAuth();
  const currentUid = user?.uid || 'user_active';
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission === 'granted' : false
  );

  const loadInbox = async () => {
    const list = await DailyQuestService.getNotificationInbox(currentUid);
    setNotifications(list);
  };

  const handleRequestPermission = async () => {
    haptics.medium();
    const granted = await notificationManager.requestNotificationPermission();
    setHasPermission(granted);
  };

  useEffect(() => {
    if (isOpen) {
      loadInbox();
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setHasPermission(Notification.permission === 'granted');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMarkAsRead = async (id: string) => {
    haptics.light();
    await DailyQuestService.markAsRead(id);
    await loadInbox();
  };

  const handleDismiss = async (id: string) => {
    haptics.medium();
    await DailyQuestService.dismissNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleSelectNotif = async (n: AppNotification) => {
    haptics.selection();
    await DailyQuestService.markAsRead(n.id);
    onClose();
    if (n.deepLink && onNavigateDeepLink) {
      onNavigateDeepLink(n.deepLink);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'weatherOpportunity':
        return <Sun size={18} style={{ color: '#84CC16' }} />;
      case 'groupQuest':
      case 'friendInvite':
        return <Users size={18} style={{ color: '#C99A45' }} />;
      case 'savedQuest':
      case 'questReminder':
        return <Bookmark size={18} style={{ color: '#EAB308' }} />;
      default:
        return <Compass size={18} style={{ color: '#C99A45' }} />;
    }
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
          maxWidth: 480,
          backgroundColor: '#22231D',
          border: '1px solid rgba(201, 154, 69, 0.3)',
          borderRadius: 24,
          padding: 24,
          color: '#F6F1E7',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={20} style={{ color: '#C99A45' }} />
            <Badge variant="brand" mono>NOTIFICATION INBOX</Badge>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.6)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <Heading variant="headingLG" style={{ fontFamily: 'serif', marginBottom: 4 }}>
          Thoughtful Moments
        </Heading>
        <Text variant="bodySM" color="secondary" style={{ marginBottom: 12 }}>
          Real-world experience suggestions timed for your calm daily rhythm.
        </Text>

        {!hasPermission && typeof window !== 'undefined' && 'Notification' in window && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: 'rgba(201, 154, 69, 0.12)',
              border: '1px solid rgba(201, 154, 69, 0.3)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, color: 'rgba(246, 241, 231, 0.9)' }}>
              Enable system alerts to get timely quest reminders.
            </div>
            <button
              onClick={handleRequestPermission}
              style={{
                backgroundColor: 'var(--color-accent)',
                color: '#171813',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              ENABLE
            </button>
          </div>
        )}

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'rgba(246, 241, 231, 0.6)' }}>
              <Compass size={32} style={{ margin: '0 auto 12px', color: '#C99A45' }} />
              <Heading variant="headingMD" style={{ color: '#F6F1E7', marginBottom: 4 }}>All Quiet</Heading>
              <Text variant="bodySM" color="secondary">No pending notifications. We only reach out when something genuine is waiting.</Text>
            </div>
          ) : (
            notifications.map(n => {
              const isUnread = !n.readAt;
              return (
                <div
                  key={n.id}
                  onClick={() => handleSelectNotif(n)}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: isUnread ? 'rgba(201, 154, 69, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    border: isUnread ? '1px solid rgba(201, 154, 69, 0.3)' : '1px solid rgba(86, 100, 58, 0.2)',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <div style={{ marginTop: 2, flexShrink: 0 }}>{getIcon(n.type)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#F6F1E7' }}>{n.title}</span>
                      {isUnread && <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#84CC16' }} />}
                    </div>
                    <p style={{ fontSize: 13, color: 'rgba(246, 241, 231, 0.8)', margin: 0, lineHeight: 1.4 }}>
                      {n.body}
                    </p>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleDismiss(n.id);
                    }}
                    style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.4)', cursor: 'pointer', padding: 4 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <Button variant="secondary" onClick={onClose} style={{ width: '100%', marginTop: 16 }}>
          CLOSE INBOX
        </Button>
      </Card>
    </div>
  );
};

export default NotificationInboxModal;
