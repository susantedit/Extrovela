import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Flag, Ban, Check, X, Search, UserMinus, Clock, AlertCircle } from 'lucide-react';
import { FriendProfile, Friendship, ReportReason } from '../../types/social';
import { SocialService } from '../../services/social';
import { subscribeAcceptedFriendships, subscribePendingFriendRequests } from '../../services/social/socialRealtime';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, Heading, Text, Input } from '../primitives';
import { haptics } from '../../utils/haptics';

const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'harassment', label: 'Harassment or Bullying' },
  { key: 'spam', label: 'Spam or Promotional Activity' },
  { key: 'unsafe_behavior', label: 'Unsafe Real-World Behavior' },
  { key: 'inappropriate_content', label: 'Inappropriate Content' },
  { key: 'impersonation', label: 'Impersonation' },
  { key: 'other', label: 'Other Safety Concern' },
];

export const FriendsScreen: React.FC = () => {
  const { user } = useAuth();
  const currentUid = user?.uid;

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [searchHandle, setSearchHandle] = useState('');
  const [foundProfile, setFoundProfile] = useState<FriendProfile | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('unsafe_behavior');
  const [reportNote, setReportNote] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentUid) return;
    try {
      const [friendList, pendingList] = await Promise.all([
        SocialService.getFriends(currentUid),
        SocialService.getPendingRequests(currentUid),
      ]);
      setFriends(friendList);
      setPendingRequests(pendingList);
    } catch (err: any) {
      // Fail-soft: keep existing state
    }
  }, [currentUid]);

  useEffect(() => {
    if (!currentUid) return;
    loadData();

    // Bounded realtime listeners (no-ops under local-first fallback)
    const unsubFriends = subscribeAcceptedFriendships(currentUid, () => {
      // When accepted friendships change, refresh the rich companion profiles
      SocialService.getFriends(currentUid).then(setFriends).catch(() => {});
    });

    const unsubPending = subscribePendingFriendRequests(currentUid, (reqs) => {
      setPendingRequests(reqs);
    });

    return () => {
      unsubFriends();
      unsubPending();
    };
  }, [currentUid, loadData]);

  if (!currentUid) {
    return (
      <div className="container py-32 text-center" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <Users size={28} style={{ color: 'var(--color-accent)' }} />
        </div>
        <Heading variant="headingLG" style={{ marginBottom: 8 }}>
          Sign In to Connect
        </Heading>
        <Text variant="bodyMD" color="secondary">
          Connect with companions to invite friends on quests and preserve shared memories together.
        </Text>
      </div>
    );
  }

  const handleSearchUser = async () => {
    if (!searchHandle) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    haptics.light();
    try {
      const result = await SocialService.searchUserByHandle(searchHandle, currentUid);
      if (result) {
        setFoundProfile(result);
      } else {
        setFoundProfile(null);
        setErrorMessage('No companion found matching this handle.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Search limit reached. Please wait a moment.');
    }
  };

  const handleSendRequest = async (targetId: string) => {
    haptics.success();
    setErrorMessage(null);
    try {
      await SocialService.sendFriendRequest(currentUid, targetId);
      setSuccessMessage('Companion request sent!');
      setFoundProfile(null);
      setSearchHandle('');
      setTimeout(() => {
        setIsAddModalOpen(false);
        setSuccessMessage(null);
      }, 1500);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to send companion request.');
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    haptics.success();
    try {
      await SocialService.acceptFriendRequest(friendshipId);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to accept request.');
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    haptics.medium();
    try {
      await SocialService.declineFriendRequest(friendshipId);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to decline request.');
    }
  };

  const handleRemoveFriend = async (friend: FriendProfile) => {
    haptics.medium();
    try {
      await SocialService.removeFriend(currentUid, friend.id);
      setFriends(prev => prev.filter(f => f.id !== friend.id));
      setSelectedFriend(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove companion.');
    }
  };

  const handleBlock = async (friend: FriendProfile) => {
    haptics.medium();
    try {
      await SocialService.blockUser(currentUid, friend.id);
      setFriends(prev => prev.filter(f => f.id !== friend.id));
      setSelectedFriend(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to block user.');
    }
  };

  const handleConfirmReport = async () => {
    if (!selectedFriend) return;
    haptics.medium();
    try {
      await SocialService.reportUser(currentUid, selectedFriend.id, reportReason, reportNote);
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setShowReportModal(false);
        setSelectedFriend(null);
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit report.');
    }
  };

  return (
    <div className="container py-32" style={{ maxWidth: 720 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-24" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Badge variant="brand" mono className="mb-8">INTENTIONAL CONNECTIONS</Badge>
          <Heading variant="display" style={{ fontSize: 'clamp(26px, 5vw, 36px)', fontWeight: 900 }}>
            Companions
          </Heading>
          <Text variant="bodyMD" color="secondary" style={{ marginTop: 4 }}>
            People you share real-world experiences with. No public feeds or follower counts.
          </Text>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            haptics.selection();
            setErrorMessage(null);
            setSuccessMessage(null);
            setFoundProfile(null);
            setSearchHandle('');
            setIsAddModalOpen(true);
          }}
          leftIcon={<UserPlus size={16} />}
        >
          Add Companion
        </Button>
      </div>

      {/* Pending Incoming Requests Section */}
      {pendingRequests.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Clock size={16} style={{ color: 'var(--color-accent)' }} />
            <Text variant="label" style={{ color: 'var(--color-accent)', margin: 0 }}>
              PENDING REQUESTS ({pendingRequests.length})
            </Text>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingRequests.map(req => {
              const requesterId = req.requestedBy;
              return (
                <Card
                  key={req.id}
                  style={{
                    backgroundColor: 'rgba(201, 154, 69, 0.08)',
                    border: '1px solid rgba(201, 154, 69, 0.3)',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(201, 154, 69, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: 'var(--color-accent)',
                      }}
                    >
                      {requesterId.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>
                        Companion Invitation
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        User {requesterId} would like to explore together
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="glass"
                      size="sm"
                      onClick={() => handleDeclineRequest(req.id)}
                      leftIcon={<X size={14} />}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAcceptRequest(req.id)}
                      leftIcon={<Check size={14} />}
                    >
                      Accept
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {friends.length === 0 ? (
          <Card style={{ padding: 32, textAlign: 'center', backgroundColor: 'var(--color-surface)' }}>
            <Users size={32} style={{ color: 'var(--color-accent)', margin: '0 auto 12px' }} />
            <Heading variant="headingMD" style={{ marginBottom: 6 }}>No Companions Yet</Heading>
            <Text variant="bodySM" color="secondary" style={{ marginBottom: 16 }}>
              Some experiences are best shared. Invite a companion to complete a quest together.
            </Text>
            <Button variant="glass" onClick={() => setIsAddModalOpen(true)}>
              Add Your First Companion
            </Button>
          </Card>
        ) : (
          friends.map(friend => (
            <Card
              key={friend.id}
              onClick={() => {
                haptics.light();
                setSelectedFriend(friend);
              }}
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                padding: '18px 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(201, 154, 69, 0.15)',
                    border: '1px solid rgba(201, 154, 69, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: '#C99A45',
                  }}
                >
                  {friend.displayName ? friend.displayName.charAt(0).toUpperCase() : 'C'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
                    {friend.displayName}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {friend.handle || `@companion_${friend.id.slice(0, 6)}`} • {friend.sharedExperienceCount} shared experiences
                  </div>
                </div>
              </div>

              <Badge variant="accent" mono>Active</Badge>
            </Card>
          ))
        )}
      </div>

      {/* Add Companion Modal */}
      {isAddModalOpen && (
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
          <Card style={{ maxWidth: 440, width: '100%', backgroundColor: '#22231D', border: '1px solid rgba(201, 154, 69, 0.3)', padding: 24, borderRadius: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Heading variant="headingMD" style={{ color: '#F6F1E7' }}>Add Companion</Heading>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.6)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <Text variant="bodySM" color="secondary" style={{ marginBottom: 16 }}>
              Enter their unique handle (e.g. @alex_rivers) to send a companion request.
            </Text>

            {errorMessage && (
              <Text variant="caption" style={{ color: '#EF4444', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14} />
                {errorMessage}
              </Text>
            )}

            {successMessage && (
              <Text variant="caption" style={{ color: '#84CC16', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={14} />
                {successMessage}
              </Text>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <Input
                placeholder="@username"
                value={searchHandle}
                onChange={e => setSearchHandle(e.target.value)}
                style={{ flex: 1 }}
              />
              <Button variant="glass" onClick={handleSearchUser} leftIcon={<Search size={14} />}>
                Find
              </Button>
            </div>

            {foundProfile && (
              <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 14, borderRadius: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: '#F6F1E7' }}>{foundProfile.displayName}</div>
                <div style={{ fontSize: 12, color: '#C99A45', marginBottom: 6 }}>{foundProfile.handle}</div>
                <Text variant="bodySM" style={{ color: 'rgba(246, 241, 231, 0.75)', fontSize: 12, marginBottom: 12 }}>
                  {foundProfile.bio || 'Explorer in the Extrovela community.'}
                </Text>
                <Button variant="primary" size="sm" onClick={() => handleSendRequest(foundProfile.id)} style={{ width: '100%' }}>
                  SEND COMPANION REQUEST
                </Button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <Button variant="secondary" onClick={() => setIsAddModalOpen(false)} style={{ width: '100%' }}>
                CLOSE
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Companion Detail & Safety Drawer */}
      {selectedFriend && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(23, 24, 19, 0.95)',
            backdropFilter: 'blur(20px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: 20,
          }}
        >
          <Card style={{ backgroundColor: '#22231D', border: '1px solid rgba(86, 100, 58, 0.4)', borderRadius: 20, padding: 24, color: '#F6F1E7', maxWidth: 480, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Badge variant="brand" mono>COMPANION PROFILE</Badge>
              <button onClick={() => setSelectedFriend(null)} style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.6)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <Heading variant="headingLG" style={{ marginBottom: 4 }}>
              {selectedFriend.displayName}
            </Heading>
            <Text variant="bodySM" style={{ color: '#C99A45', marginBottom: 16 }}>
              {selectedFriend.handle || `@companion_${selectedFriend.id.slice(0, 6)}`}
            </Text>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: 16, borderRadius: 12, marginBottom: 20 }}>
              <Text variant="bodySM" style={{ color: 'rgba(246, 241, 231, 0.8)' }}>
                {selectedFriend.bio || 'Exploring hidden viewpoints and quiet places.'}
              </Text>
            </div>

            {reportSuccess ? (
              <div style={{ padding: 12, backgroundColor: 'rgba(132, 204, 22, 0.15)', border: '1px solid #84CC16', borderRadius: 12, textAlign: 'center', color: '#84CC16', fontSize: 13, marginBottom: 16 }}>
                Report received. Our safety team will review this.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <Button variant="secondary" size="sm" onClick={() => handleRemoveFriend(selectedFriend)} leftIcon={<UserMinus size={14} />} style={{ flex: 1 }}>
                  Remove
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleBlock(selectedFriend)} leftIcon={<Ban size={14} />} style={{ flex: 1 }}>
                  Block
                </Button>
                <Button variant="glass" size="sm" onClick={() => setShowReportModal(true)} leftIcon={<Flag size={14} />} style={{ flex: 1 }}>
                  Report
                </Button>
              </div>
            )}

            <Button variant="secondary" onClick={() => setSelectedFriend(null)} style={{ width: '100%' }}>
              CLOSE
            </Button>
          </Card>
        </div>
      )}

      {/* Safety Report Modal */}
      {showReportModal && selectedFriend && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Card style={{ backgroundColor: '#20211B', border: '1px solid var(--color-border)', maxWidth: 400, width: '100%', padding: 20 }}>
            <Heading variant="headingMD" style={{ color: '#F6F1E7', marginBottom: 12 }}>
              Report {selectedFriend.displayName}
            </Heading>
            <Text variant="bodySM" color="secondary" style={{ marginBottom: 16 }}>
              Select a reason to help us maintain a safe community.
            </Text>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {REPORT_REASONS.map(r => (
                <button
                  key={r.key}
                  onClick={() => setReportReason(r.key)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    textAlign: 'left',
                    backgroundColor: reportReason === r.key ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)',
                    color: reportReason === r.key ? '#000' : '#F6F1E7',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Optional additional context..."
              value={reportNote}
              onChange={e => setReportNote(e.target.value)}
              style={{
                width: '100%',
                height: 60,
                backgroundColor: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: 8,
                color: '#F6F1E7',
                fontSize: 13,
                marginBottom: 16,
              }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowReportModal(false)} style={{ flex: 1 }}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmReport} style={{ flex: 1 }}>
                Submit Report
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FriendsScreen;
