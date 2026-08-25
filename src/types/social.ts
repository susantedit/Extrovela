/**
 * EXTROVELA — Social Domain Types (Phase 9)
 * 
 * Intentional, privacy-first social contracts for friends, quest sharing,
 * group quests, shared experiences, blocking, and reporting.
 */

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked' | 'removed';

export interface Friendship {
  id: string;
  userA: string;
  userB: string;
  status: FriendshipStatus;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FriendProfile {
  id: string;
  displayName: string;
  handle: string;
  photoURL?: string;
  bio?: string;
  sharedExperienceCount: number;
}

export interface UserBlock {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export type ReportReason = 'harassment' | 'spam' | 'unsafe_behavior' | 'inappropriate_content' | 'impersonation' | 'other';

export interface UserReport {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: ReportReason;
  description?: string;
  relatedQuestId?: string;
  relatedInviteId?: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: string;
}

export type QuestInviteType = 'friend' | 'link';
export type QuestInviteStatus = 'active' | 'accepted' | 'declined' | 'expired' | 'cancelled' | 'completed';

export interface QuestInvite {
  id: string;
  questId: string;
  creatorId: string;
  creatorName: string;
  questTitle: string;
  estimatedDuration: string;
  approximateArea: string;
  type: QuestInviteType;
  inviteToken: string;
  status: QuestInviteStatus;
  maxParticipants: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export type ParticipantRole = 'creator' | 'participant';
export type ParticipantStatus = 'invited' | 'accepted' | 'declined' | 'active' | 'left' | 'completed' | 'removed';

export interface QuestParticipant {
  id: string;
  questId: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  joinedAt: string;
  leftAt?: string;
  completedAt?: string;
}

export type GroupQuestState = 'waiting' | 'starting' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface GroupQuestSession {
  id: string;
  questId: string;
  creatorId: string;
  state: GroupQuestState;
  participants: QuestParticipant[];
  /**
   * Denormalized member-uid list for DISPLAY and for the Firestore read rule's
   * `participantIds` membership check. NOT a security boundary — the authoritative
   * membership is the `members/{uid}` subcollection (Phase 14). Optional so Phase 9
   * code that builds sessions without it stays valid.
   */
  participantIds?: string[];
  startedAt?: string;
  completedAt?: string;
  sharedExperienceId?: string;
}

export interface SharedExperience {
  id: string;
  questId: string;
  questTitle: string;
  creatorId: string;
  participantIds: string[];
  participantNames: string[];
  completedAt: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 14 — Firestore-backed social (all additive; nothing above is changed).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Public, minimally-scoped profile stored at `users/{uid}/public/profile`.
 * Readable by any authenticated user (so friends/search can render a name), which
 * is exactly why it holds ONLY these fields — never location, email, or memories.
 */
export interface PublicProfile {
  uid: string;
  displayName: string;
  handle: string; // display form, e.g. "@alex_rivers"
  handleLower: string; // normalized lookup key; must equal the handles/{handleLower} doc id
  photoURL?: string;
  bio?: string;
  updatedAt: string;
}

/** Global handle → uid claim at `handles/{handleLower}`. Create-only ⇒ first writer wins. */
export interface HandleClaim {
  uid: string;
  handleLower: string;
  claimedAt: string;
}

export type FriendRequestPolicy = 'anyone' | 'none';

/**
 * Owner-only privacy controls at `users/{uid}/settings/privacy`. Defaults lean
 * private: precise location is never shared socially, richer profile data is
 * friends-only. Handle discovery defaults on because a handle is a shared
 * identifier (like a username) and the add-companion flow depends on it; users
 * can opt out.
 */
export interface SocialPrivacySettings {
  discoverableByHandle: boolean;
  allowFriendRequests: FriendRequestPolicy;
  shareExactLocation: boolean;
  showActivityToFriends: boolean;
  updatedAt?: string;
}

export const DEFAULT_SOCIAL_PRIVACY: SocialPrivacySettings = {
  discoverableByHandle: true,
  allowFriendRequests: 'anyone',
  shareExactLocation: false,
  showActivityToFriends: true,
};

/** Role within a group quest session. Distinct from ParticipantRole (do not merge). */
export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type GroupMemberStatus = 'invited' | 'active' | 'declined' | 'left' | 'removed';

/**
 * Authoritative membership doc at `groupQuestSessions/{sessionId}/members/{uid}`.
 * Created by an OWNER/ADMIN (invite); the invitee only ever updates their own row's
 * status (accept/decline/leave) and can never change `role`. This is what lets the
 * Security Rules enforce group membership with no server.
 */
export interface GroupMember {
  uid: string;
  role: GroupRole;
  status: GroupMemberStatus;
  displayName?: string;
  invitedBy?: string;
  joinedAt: string;
  updatedAt?: string;
}
