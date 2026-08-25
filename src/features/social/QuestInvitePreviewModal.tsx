import React, { useState, useEffect } from 'react';
import { Users, Clock, MapPin, ShieldCheck, Check, X, AlertTriangle } from 'lucide-react';
import { QuestInvite } from '../../types/social';
import { QuestSharingService } from '../../services/social/questSharingService';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, Heading, Text } from '../../components/primitives';
import { haptics } from '../../utils/haptics';

interface QuestInvitePreviewModalProps {
  inviteToken: string | null;
  isOpen: boolean;
  onClose: () => void;
  onAcceptInvite: (invite: QuestInvite) => void;
}

export const QuestInvitePreviewModal: React.FC<QuestInvitePreviewModalProps> = ({
  inviteToken,
  isOpen,
  onClose,
  onAcceptInvite,
}) => {
  const { user } = useAuth();
  const currentUid = user?.uid || 'user_active';

  const [invite, setInvite] = useState<QuestInvite | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAndValidate() {
      if (!isOpen || !inviteToken) return;
      setIsLoading(true);
      setErrorReason(null);

      const result = await QuestSharingService.validateInviteToken(inviteToken, currentUid);

      if (result.valid && result.invite) {
        setInvite(result.invite);
      } else {
        setErrorReason(result.reason || 'Invalid or expired invite token.');
      }
      setIsLoading(false);
    }
    loadAndValidate();
  }, [isOpen, inviteToken]);

  if (!isOpen) return null;

  const handleAccept = () => {
    if (!invite) return;
    haptics.success();
    onAcceptInvite(invite);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18, 19, 15, 0.96)',
        backdropFilter: 'blur(24px)',
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
          maxWidth: 460,
          backgroundColor: '#22231D',
          border: '1px solid rgba(201, 154, 69, 0.3)',
          borderRadius: 24,
          padding: 24,
          color: '#F6F1E7',
          animation: 'fadeIn 0.3s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Badge variant="brand" mono>QUEST INVITATION</Badge>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.6)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#C99A45' }}>
            <Text variant="bodyMD">Validating secure invitation...</Text>
          </div>
        ) : errorReason ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <AlertTriangle size={36} style={{ color: '#EF4444', margin: '0 auto 12px' }} />
            <Heading variant="headingMD" style={{ color: '#F6F1E7', marginBottom: 8 }}>
              Unable to Join Quest
            </Heading>
            <Text variant="bodySM" color="secondary" style={{ marginBottom: 24 }}>
              {errorReason}
            </Text>
            <Button variant="secondary" onClick={onClose} style={{ width: '100%' }}>
              CLOSE PREVIEW
            </Button>
          </div>
        ) : invite ? (
          <div>
            <div style={{ backgroundColor: 'rgba(201, 154, 69, 0.1)', border: '1px solid rgba(201, 154, 69, 0.25)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
              <Text variant="caption" style={{ color: '#84CC16', textTransform: 'uppercase', marginBottom: 4, display: 'block', fontWeight: 600 }}>
                INVITATION FROM {invite.creatorName.toUpperCase()}
              </Text>
              <Heading variant="headingLG" style={{ fontFamily: 'serif', marginBottom: 8, color: '#F6F1E7' }}>
                {invite.questTitle}
              </Heading>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(246, 241, 231, 0.8)' }}>
                  <Clock size={14} style={{ color: '#C99A45' }} />
                  <span>{invite.estimatedDuration}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(246, 241, 231, 0.8)' }}>
                  <MapPin size={14} style={{ color: '#C99A45' }} />
                  <span>{invite.approximateArea}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(246, 241, 231, 0.8)' }}>
                  <Users size={14} style={{ color: '#C99A45' }} />
                  <span>Max {invite.maxParticipants} companions</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(246, 241, 231, 0.5)', marginBottom: 24 }}>
              <ShieldCheck size={14} style={{ color: '#84CC16' }} />
              <span>Private invitation. No continuous location tracking.</span>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                DECLINE
              </Button>
              <Button variant="primary" onClick={handleAccept} leftIcon={<Check size={16} />} style={{ flex: 2 }}>
                ACCEPT & JOIN
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
};

export default QuestInvitePreviewModal;
