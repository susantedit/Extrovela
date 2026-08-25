import React, { useState, useEffect } from 'react';
import { Users, Copy, Check, ShieldCheck, X, Link, UserCheck } from 'lucide-react';
import { useAppState } from '../context/AppStateContext';
import { useAuth } from '../context/AuthContext';
import { QuestSharingService, SocialService } from '../services/social';
import { QuestInvite, FriendProfile } from '../types/social';
import { Card, Button, Badge, Heading, Text } from './primitives';
import { haptics } from '../utils/haptics';

export const CoQuestModal: React.FC = () => {
  const { coQuestModalQuest, setCoQuestModalQuest } = useAppState();
  const { user } = useAuth();
  const currentUid = user?.uid || 'user_guest';
  const currentName = user?.displayName || 'Fellow Explorer';

  const [invite, setInvite] = useState<QuestInvite | null>(null);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coQuestModalQuest) {
      setInvite(null);
      setSelectedFriendIds(new Set());
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    // Generate real secure invite token (doc ID = token)
    QuestSharingService.createInvite(
      coQuestModalQuest,
      currentUid,
      currentName,
      'link',
      4
    )
      .then(newInvite => {
        if (isMounted) setInvite(newInvite);
      })
      .catch(err => {
        if (isMounted) setError(err.message || 'Unable to generate invite link.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    // Load user's real companions
    if (user?.uid) {
      SocialService.getFriends(user.uid)
        .then(list => {
          if (isMounted) setFriends(list);
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [coQuestModalQuest, currentUid, currentName, user?.uid]);

  if (!coQuestModalQuest) return null;

  const inviteUrl = invite ? QuestSharingService.getShareUrl(invite) : '';

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    haptics.success();
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFriend = (id: string) => {
    haptics.selection();
    setSelectedFriendIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} style={{ color: 'var(--color-accent)' }} />
            <Badge variant="brand" mono>CO-QUEST & INVITE</Badge>
          </div>
          <button
            onClick={() => setCoQuestModalQuest(null)}
            style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.6)', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Quest Info */}
        <div
          style={{
            backgroundColor: 'rgba(201, 154, 69, 0.08)',
            border: '1px solid rgba(201, 154, 69, 0.25)',
            borderRadius: 14,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <span className="font-mono text-xs" style={{ color: '#C99A45', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Shared Experience
          </span>
          <Heading variant="headingMD" style={{ fontSize: 17, marginTop: 4, marginBottom: 4 }}>
            {coQuestModalQuest.title}
          </Heading>
          <Text variant="bodySM" color="secondary" style={{ fontSize: 13, lineHeight: 1.4 }}>
            {coQuestModalQuest.description}
          </Text>
        </div>

        {/* Share Direct Secure Link */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#F6F1E7', marginBottom: 8, display: 'block' }}>
            1. Share Secure 24-Hour Link
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              readOnly
              value={isLoading ? 'Generating secure token...' : inviteUrl || (error ?? 'Unavailable')}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 12,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(86, 100, 58, 0.3)',
                color: '#F6F1E7',
                fontSize: 12,
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <Button
              variant="primary"
              onClick={handleCopy}
              disabled={!inviteUrl || isLoading}
              leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
              style={{ whiteSpace: 'nowrap' }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <Text variant="caption" color="secondary" style={{ marginTop: 6, display: 'block', fontSize: 11 }}>
            Invitees can open this link to preview and accept the shared quest.
          </Text>
        </div>

        {/* Invite Companions Directly */}
        {friends.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#F6F1E7', marginBottom: 8, display: 'block' }}>
              2. Choose Companions ({selectedFriendIds.size} selected)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 150, overflowY: 'auto' }}>
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
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#F6F1E7' }}>{friend.displayName}</div>
                      <div style={{ fontSize: 11, color: 'rgba(246, 241, 231, 0.6)' }}>{friend.handle}</div>
                    </div>
                    {isSelected ? <Check size={16} style={{ color: '#C99A45' }} /> : <span style={{ fontSize: 11, color: 'rgba(246, 241, 231, 0.4)' }}>Select</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Safety Assurance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(246, 241, 231, 0.5)', marginBottom: 20 }}>
          <ShieldCheck size={14} style={{ color: '#84CC16' }} />
          <span>Location privacy preserved. No continuous background tracking.</span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={() => setCoQuestModalQuest(null)} style={{ flex: 1 }}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleCopy}
            disabled={!inviteUrl}
            leftIcon={<Link size={14} />}
            style={{ flex: 2 }}
          >
            {copied ? 'Link Copied!' : 'Copy Share Link'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default CoQuestModal;
