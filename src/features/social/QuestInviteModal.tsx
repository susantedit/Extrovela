/**
 * EXTROVELA — Quest Sharing & Invitation Modal (Phase 9)
 * 
 * Clean, calming interface to invite friends or copy a secure 24-hour invite link.
 */

import React, { useState, useEffect } from 'react';
import { Users, Link, Copy, Check, ShieldCheck, X } from 'lucide-react';
import { Quest } from '../../types/quest';
import { FriendProfile, QuestInvite } from '../../types/social';
import { SocialService, QuestSharingService } from '../../services/social';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, Heading, Text } from '../../components/primitives';
import { haptics } from '../../utils/haptics';

interface QuestInviteModalProps {
  quest: Quest;
  isOpen: boolean;
  onClose: () => void;
  onStartGroupQuest: (selectedFriends: FriendProfile[]) => void;
}

export const QuestInviteModal: React.FC<QuestInviteModalProps> = ({
  quest,
  isOpen,
  onClose,
  onStartGroupQuest,
}) => {
  const { user } = useAuth();
  const currentUid = user?.uid || 'user_active';
  const currentName = user?.displayName || 'Host';

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [invite, setInvite] = useState<QuestInvite | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && currentUid) {
      SocialService.getFriends(currentUid).then(setFriends).catch(() => {});
      QuestSharingService.createInvite(quest, currentUid, currentName, 'link', 4).then(setInvite).catch(() => {});
    }
  }, [isOpen, quest, currentUid, currentName]);


  if (!isOpen) return null;

  const toggleFriend = (id: string) => {
    haptics.selection();
    setSelectedFriendIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyLink = () => {
    if (!invite) return;
    haptics.success();
    const url = QuestSharingService.getShareUrl(invite);
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const selectedFriendsList = friends.filter(f => selectedFriendIds.has(f.id));

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
          borderRadius: 20,
          padding: 24,
          color: '#F6F1E7',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} style={{ color: '#C99A45' }} />
            <Badge variant="brand" mono>INVITE COMPANIONS</Badge>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.6)', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <Heading variant="headingLG" style={{ fontFamily: 'serif', marginBottom: 6 }}>
          {quest.title}
        </Heading>
        <Text variant="bodySM" color="secondary" style={{ marginBottom: 20 }}>
          {quest.time || '30-45 mins'} • {quest.cityContext?.[0] || 'Local Area'} • Up to 4 companions
        </Text>

        {/* Friend Selection */}
        <Text variant="label" style={{ color: '#C99A45', marginBottom: 8, display: 'block' }}>
          CHOOSE FROM FRIENDS
        </Text>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, maxHeight: 180, overflowY: 'auto' }}>
          {friends.map(friend => {
            const isSelected = selectedFriendIds.has(friend.id);
            return (
              <div
                key={friend.id}
                onClick={() => toggleFriend(friend.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 12,
                  backgroundColor: isSelected ? 'rgba(201, 154, 69, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  border: isSelected ? '1px solid #C99A45' : '1px solid rgba(86, 100, 58, 0.2)',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#F6F1E7' }}>{friend.displayName}</div>
                  <div style={{ fontSize: 12, color: 'rgba(246, 241, 231, 0.6)' }}>{friend.handle}</div>
                </div>
                {isSelected ? <Check size={18} style={{ color: '#C99A45' }} /> : <span style={{ fontSize: 12, color: 'rgba(246, 241, 231, 0.4)' }}>Add</span>}
              </div>
            );
          })}
        </div>

        {/* Secure Link Generation */}
        <Text variant="label" style={{ color: 'rgba(246, 241, 231, 0.8)', marginBottom: 8, display: 'block' }}>
          OR SHARE SECURE 24-HOUR LINK
        </Text>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: 12,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(86, 100, 58, 0.3)',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(246, 241, 231, 0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Link size={14} style={{ color: '#C99A45', flexShrink: 0 }} />
            <span>{invite ? QuestSharingService.getShareUrl(invite) : 'Generating...'}</span>
          </div>

          <button
            onClick={handleCopyLink}
            style={{
              background: 'none',
              border: 'none',
              color: copied ? '#84CC16' : '#C99A45',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 8px',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Privacy Note */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(246, 241, 231, 0.5)', marginBottom: 20 }}>
          <ShieldCheck size={14} style={{ color: '#84CC16' }} />
          <span>Your live GPS is never broadcast. Each person saves their own memory.</span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>
            CANCEL
          </Button>
          <Button
            variant="primary"
            disabled={selectedFriendsList.length === 0}
            onClick={() => onStartGroupQuest(selectedFriendsList)}
            style={{ flex: 2 }}
          >
            START WITH {selectedFriendsList.length > 0 ? selectedFriendsList.length : ''} COMPANION{selectedFriendsList.length === 1 ? '' : 'S'}
          </Button>
        </div>
      </Card>
    </div>
  );
};
