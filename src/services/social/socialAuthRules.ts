/**
 * EXTROVELA — Pure TypeScript Firestore Security Rules Mirror (Phase 14)
 *
 * This file is an exact, pure TypeScript mirror of the Firestore Security Rules
 * predicates defined in `firestore.rules`.
 *
 * It allows testing and verifying all authorization boundaries, invariant checks,
 * role transitions, block precedences, and adversarial scenarios without requiring
 * live Firebase emulator processes.
 */

export interface AuthContext {
  uid: string | null;
}

export interface SecurityRulesDatabaseState {
  userBlocks: Map<string, { blockerId: string; blockedId: string }>;
  friendships: Map<string, { userA: string; userB: string; status: string; requestedBy: string }>;
  handles: Map<string, { uid: string; handleLower: string }>;
  questInvites: Map<string, { creatorId: string; inviteToken: string; status: string }>;
  groupQuestSessions: Map<string, { creatorId: string; state: string }>;
  sessionMembers: Map<string, { uid: string; role: 'OWNER' | 'ADMIN' | 'MEMBER'; status: string }>; // key: `${sessionId}__${uid}`
  sharedExperiences: Map<string, { creatorId: string; participantIds: string[] }>;
  reports: Map<string, { reporterId: string; reportedUserId: string; reason: string }>;
  userNotifications: Map<string, { userId: string; id: string; type: string }>; // key: `${userId}__${notifId}`
  userMemories: Map<string, { userId: string; memoryId: string }>;
  userQuests: Map<string, { userId: string; questId: string }>;
}

export class SocialAuthRulesEngine {
  private db: SecurityRulesDatabaseState;

  constructor(initialState?: Partial<SecurityRulesDatabaseState>) {
    this.db = {
      userBlocks: initialState?.userBlocks ?? new Map(),
      friendships: initialState?.friendships ?? new Map(),
      handles: initialState?.handles ?? new Map(),
      questInvites: initialState?.questInvites ?? new Map(),
      groupQuestSessions: initialState?.groupQuestSessions ?? new Map(),
      sessionMembers: initialState?.sessionMembers ?? new Map(),
      sharedExperiences: initialState?.sharedExperiences ?? new Map(),
      reports: initialState?.reports ?? new Map(),
      userNotifications: initialState?.userNotifications ?? new Map(),
      userMemories: initialState?.userMemories ?? new Map(),
      userQuests: initialState?.userQuests ?? new Map(),
    };
  }

  // ── Helper functions mirroring firestore.rules ──────────────────────────

  private isAuthenticated(auth: AuthContext): boolean {
    return auth.uid !== null && auth.uid !== undefined && auth.uid.length > 0;
  }

  private isOwner(auth: AuthContext, userId: string): boolean {
    return this.isAuthenticated(auth) && auth.uid === userId;
  }

  private sessionCreatorId(sessionId: string): string | undefined {
    return this.db.groupQuestSessions.get(sessionId)?.creatorId;
  }

  private isSessionMember(sessionId: string, uid: string): boolean {
    return this.db.sessionMembers.has(`${sessionId}__${uid}`);
  }

  private isSessionManager(sessionId: string, uid: string): boolean {
    if (!this.isSessionMember(sessionId, uid)) return false;
    const member = this.db.sessionMembers.get(`${sessionId}__${uid}`);
    return member?.role === 'OWNER' || member?.role === 'ADMIN';
  }

  private noBlockBetween(a: string, b: string): boolean {
    const key1 = `${a}__${b}`;
    const key2 = `${b}__${a}`;
    return !this.db.userBlocks.has(key1) && !this.db.userBlocks.has(key2);
  }

  // ── Friendships Collection ──────────────────────────────────────────────

  canReadFriendship(auth: AuthContext, resource: { userA: string; userB: string }): boolean {
    return this.isAuthenticated(auth) && (resource.userA === auth.uid || resource.userB === auth.uid);
  }

  canCreateFriendship(
    auth: AuthContext,
    friendshipId: string,
    request: { userA: string; userB: string; status: string; requestedBy: string }
  ): boolean {
    if (!this.isAuthenticated(auth)) return false;
    if (request.requestedBy !== auth.uid) return false;
    if (request.status !== 'pending') return false;
    if (typeof request.userA !== 'string' || typeof request.userB !== 'string') return false;
    if (!(request.userA < request.userB)) return false;
    if (friendshipId !== `${request.userA}__${request.userB}`) return false;
    if (auth.uid !== request.userA && auth.uid !== request.userB) return false;
    if (!this.noBlockBetween(request.userA, request.userB)) return false;
    return true;
  }

  canUpdateFriendship(
    auth: AuthContext,
    resource: { userA: string; userB: string; status: string; requestedBy: string },
    request: { userA: string; userB: string; status: string; requestedBy: string }
  ): boolean {
    if (!this.isAuthenticated(auth)) return false;
    if (resource.userA !== auth.uid && resource.userB !== auth.uid) return false;
    if (request.userA !== resource.userA) return false;
    if (request.userB !== resource.userB) return false;
    if (request.requestedBy !== resource.requestedBy) return false;
    // Requester cannot self-approve a request
    if (request.status === 'accepted' && resource.requestedBy === auth.uid) return false;
    return true;
  }

  canDeleteFriendship(auth: AuthContext, resource: { userA: string; userB: string }): boolean {
    return this.isAuthenticated(auth) && (resource.userA === auth.uid || resource.userB === auth.uid);
  }

  // ── User Blocks Collection ──────────────────────────────────────────────

  canReadBlock(auth: AuthContext, resource: { blockerId: string; blockedId: string }): boolean {
    return this.isAuthenticated(auth) && resource.blockerId === auth.uid;
  }

  canCreateBlock(
    auth: AuthContext,
    blockId: string,
    request: { blockerId: string; blockedId: string }
  ): boolean {
    if (!this.isAuthenticated(auth)) return false;
    if (request.blockerId !== auth.uid) return false;
    if (blockId !== `${auth.uid}__${request.blockedId}`) return false;
    if (request.blockedId === auth.uid) return false;
    return true;
  }

  canUpdateBlock(): boolean {
    return false; // Immutable (unblock is a delete)
  }

  canDeleteBlock(auth: AuthContext, resource: { blockerId: string }): boolean {
    return this.isAuthenticated(auth) && resource.blockerId === auth.uid;
  }

  // ── Handles Collection ──────────────────────────────────────────────────

  canReadHandle(auth: AuthContext): boolean {
    return this.isAuthenticated(auth);
  }

  canCreateHandle(auth: AuthContext, handleLower: string, request: { uid: string; handleLower: string }): boolean {
    if (!this.isAuthenticated(auth)) return false;
    if (request.uid !== auth.uid) return false;
    if (request.handleLower !== handleLower) return false;
    if (!/^[a-z0-9_]{3,30}$/.test(handleLower)) return false;
    return true;
  }

  canUpdateHandle(): boolean {
    return false; // Unstealable: first writer wins
  }

  canDeleteHandle(auth: AuthContext, resource: { uid: string }): boolean {
    return this.isAuthenticated(auth) && resource.uid === auth.uid;
  }

  // ── Quest Invites Collection ────────────────────────────────────────────

  canReadQuestInvite(auth: AuthContext): boolean {
    return this.isAuthenticated(auth);
  }

  canCreateQuestInvite(
    auth: AuthContext,
    token: string,
    request: { creatorId: string; inviteToken: string; status: string }
  ): boolean {
    if (!this.isAuthenticated(auth)) return false;
    if (request.creatorId !== auth.uid) return false;
    if (request.inviteToken !== token) return false;
    if (token.length < 22) return false;
    if (request.status !== 'active') return false;
    return true;
  }

  canUpdateQuestInvite(
    auth: AuthContext,
    resource: { creatorId: string; inviteToken: string },
    request: { creatorId: string; inviteToken: string }
  ): boolean {
    if (!this.isAuthenticated(auth)) return false;
    if (resource.creatorId !== auth.uid) return false;
    if (request.creatorId !== resource.creatorId) return false;
    if (request.inviteToken !== resource.inviteToken) return false;
    return true;
  }

  canDeleteQuestInvite(auth: AuthContext, resource: { creatorId: string }): boolean {
    return this.isAuthenticated(auth) && resource.creatorId === auth.uid;
  }

  // ── Group Quest Sessions & Members ──────────────────────────────────────

  canReadGroupSession(auth: AuthContext, sessionId: string, resource: { creatorId: string }): boolean {
    return (
      this.isAuthenticated(auth) &&
      (auth.uid === resource.creatorId || this.isSessionMember(sessionId, auth.uid!))
    );
  }

  canCreateGroupSession(auth: AuthContext, request: { creatorId: string; state: string }): boolean {
    return this.isAuthenticated(auth) && request.creatorId === auth.uid && request.state === 'waiting';
  }

  canUpdateGroupSession(
    auth: AuthContext,
    sessionId: string,
    resource: { creatorId: string },
    request: { creatorId: string }
  ): boolean {
    if (!this.isAuthenticated(auth)) return false;
    const isCreator = auth.uid === resource.creatorId;
    const isManager = this.isSessionManager(sessionId, auth.uid!);
    if (!isCreator && !isManager) return false;
    if (request.creatorId !== resource.creatorId) return false;
    return true;
  }

  canDeleteGroupSession(auth: AuthContext, resource: { creatorId: string }): boolean {
    return this.isAuthenticated(auth) && resource.creatorId === auth.uid;
  }

  // Subcollection: groupQuestSessions/{sessionId}/members/{memberUid}

  canReadSessionMember(auth: AuthContext, sessionId: string): boolean {
    return (
      this.isAuthenticated(auth) &&
      (auth.uid === this.sessionCreatorId(sessionId) || this.isSessionMember(sessionId, auth.uid!))
    );
  }

  canCreateSessionMember(
    auth: AuthContext,
    sessionId: string,
    memberUid: string,
    request: { uid: string; role: string; status: string }
  ): boolean {
    if (!this.isAuthenticated(auth)) return false;

    // Path A: Creator bootstraps own OWNER row
    const isCreatorBootstrap =
      memberUid === auth.uid &&
      request.uid === auth.uid &&
      request.role === 'OWNER' &&
      this.sessionCreatorId(sessionId) === auth.uid;

    // Path B: OWNER/ADMIN invites a third party as invited MEMBER with block check
    const isManagerInvite =
      this.isSessionManager(sessionId, auth.uid!) &&
      request.uid === memberUid &&
      request.role === 'MEMBER' &&
      request.status === 'invited' &&
      this.noBlockBetween(auth.uid!, memberUid);

    return isCreatorBootstrap || isManagerInvite;
  }

  canUpdateSessionMember(
    auth: AuthContext,
    sessionId: string,
    memberUid: string,
    resource: { uid: string; role: string; status: string },
    request: { uid: string; role: string; status: string }
  ): boolean {
    if (!this.isAuthenticated(auth)) return false;

    // Path A: Invitee accepts/declines/leaves their own row — role FROZEN
    const isSelfStatusUpdate =
      memberUid === auth.uid &&
      request.uid === resource.uid &&
      request.role === resource.role &&
      ['active', 'declined', 'left'].includes(request.status);

    // Path B: OWNER/ADMIN manages role (never above ADMIN)
    const isManagerRoleUpdate =
      this.isSessionManager(sessionId, auth.uid!) &&
      request.uid === resource.uid &&
      ['ADMIN', 'MEMBER'].includes(request.role);

    return isSelfStatusUpdate || isManagerRoleUpdate;
  }

  canDeleteSessionMember(auth: AuthContext, sessionId: string, memberUid: string): boolean {
    if (!this.isAuthenticated(auth)) return false;
    return memberUid === auth.uid || this.isSessionManager(sessionId, auth.uid!);
  }

  // ── Shared Experiences ──────────────────────────────────────────────────

  canReadSharedExperience(auth: AuthContext, resource: { participantIds: string[] }): boolean {
    return this.isAuthenticated(auth) && resource.participantIds.includes(auth.uid!);
  }

  canCreateSharedExperience(
    auth: AuthContext,
    request: { creatorId: string; participantIds: string[] }
  ): boolean {
    if (!this.isAuthenticated(auth)) return false;
    if (request.creatorId !== auth.uid) return false;
    if (!Array.isArray(request.participantIds)) return false;
    if (!request.participantIds.includes(auth.uid!)) return false;
    if (request.participantIds.length > 8) return false;
    return true;
  }

  canUpdateSharedExperience(): boolean {
    return false; // Immutable
  }

  canDeleteSharedExperience(): boolean {
    return false; // Immutable
  }

  // ── Reports ─────────────────────────────────────────────────────────────

  canCreateReport(auth: AuthContext, request: { reporterId: string }): boolean {
    return this.isAuthenticated(auth) && request.reporterId === auth.uid;
  }

  canReadReport(): boolean {
    return false; // Admins only via backend
  }

  // ── User Notifications (Owner-only boundary) ───────────────────────────

  canWriteNotification(auth: AuthContext, targetUserId: string): boolean {
    return this.isOwner(auth, targetUserId);
  }

  canReadNotification(auth: AuthContext, targetUserId: string): boolean {
    return this.isOwner(auth, targetUserId);
  }

  // ── User Private Memories & Quests (Owner-only boundary) ────────────────

  canReadUserMemory(auth: AuthContext, targetUserId: string): boolean {
    return this.isOwner(auth, targetUserId);
  }

  canWriteUserMemory(auth: AuthContext, targetUserId: string): boolean {
    return this.isOwner(auth, targetUserId);
  }
}

export default SocialAuthRulesEngine;
