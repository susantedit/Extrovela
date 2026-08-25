/**
 * EXTROVELA — Social Repository (Phase 9 core, Phase 14 Firestore-backed)
 *
 * Local-first idiom (mirrors FirestoreService): every method resolves a db handle
 * via getDb(); with a real Firebase project it reads/writes Firestore, otherwise it
 * falls back to in-memory Maps for local-first development and the Phase 9 test suite.
 *
 * Phase 14 hardening:
 *  - Authorization is enforced by Firestore Security Rules (Google-verified
 *    request.auth.uid), NOT here. Deterministic doc IDs (`a__b`) are load-bearing:
 *    they let the rules verify friendship/block relationships with exists() checks.
 *  - Safety/state writes (block, accept, decline, cancel, leave) SURFACE errors —
 *    unlike FirestoreService we never silently swallow a failed social write and
 *    pretend success. Reads fail soft (null / empty) so the UI can show empty states.
 *  - No fabricated social data ever reaches production: with no Firebase configured
 *    in a production build we FAIL CLEAN (throw), never in-memory. Seeded companions
 *    and handle-search fabrication live only behind config.features.mockSocial, which
 *    is hard-blocked in production (see env.ts).
 */

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  Firestore,
} from 'firebase/firestore';
import { getFirebaseApp } from '../services/firebase/firebaseConfig';
import config from '../config/env';
import {
  Friendship,
  FriendProfile,
  UserBlock,
  UserReport,
  QuestInvite,
  GroupQuestSession,
  QuestParticipant,
  SharedExperience,
  PublicProfile,
  HandleClaim,
  GroupMember,
  GroupRole,
  SocialPrivacySettings,
  DEFAULT_SOCIAL_PRIVACY,
} from '../types/social';
import logger from '../utils/logger';

const MOCK_USERS_DB: FriendProfile[] = [
  {
    id: 'user_alex',
    displayName: 'Alex Rivers',
    handle: '@alex_rivers',
    bio: 'Exploring quiet stone courtyards and sunset spots.',
    sharedExperienceCount: 2,
  },
  {
    id: 'user_maya',
    displayName: 'Maya Chen',
    handle: '@maya_chen',
    bio: 'Teahouse reader & rooftop star watcher.',
    sharedExperienceCount: 1,
  },
  {
    id: 'user_sam',
    displayName: 'Sam Thorne',
    handle: '@sam_thorne',
    bio: 'Mindful walks and early morning photography.',
    sharedExperienceCount: 0,
  },
];

export class SocialRepository {
  // In-memory stores. Source of truth ONLY in local-first (non-production, no
  // Firebase) mode; in Firestore mode `localBlocks` is unused (block checks read
  // Firestore directly), and the others are inert.
  private localFriendships: Map<string, Friendship> = new Map();
  private localInvites: Map<string, QuestInvite> = new Map();
  private localSessions: Map<string, GroupQuestSession> = new Map();
  private localBlocks: Map<string, UserBlock> = new Map();
  private localReports: UserReport[] = [];
  private localProfiles: Map<string, PublicProfile> = new Map();
  private localHandles: Map<string, string> = new Map(); // handleLower -> uid
  private localPrivacy: Map<string, SocialPrivacySettings> = new Map();

  constructor() {
    // Seed a sample companion ONLY when the dev-only mock flag is on. Production
    // (where mockSocial is forced false) never sees fabricated relationships.
    if (config.features.mockSocial) {
      const sampleFriendship: Friendship = {
        id: 'friend_user_active_user_alex',
        userA: 'user_active',
        userB: 'user_alex',
        status: 'accepted',
        requestedBy: 'user_alex',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.localFriendships.set(sampleFriendship.id, sampleFriendship);
    }
  }

  // ─── Infrastructure ─────────────────────────────────────────
  private getDb(): Firestore | null {
    const app = getFirebaseApp();
    if (!app) return null;
    return getFirestore(app);
  }

  /**
   * Guard for the in-memory branch: local-first persistence is fine in dev, but a
   * production build with no Firestore must NEVER silently use in-memory social
   * data. Fail clean so the failure is visible instead of faked.
   */
  private assertLocalAllowed(op: string): void {
    if (config.isProduction) {
      const msg = `Social operation "${op}" is unavailable: no Firestore backend is configured in this production build.`;
      logger.error(msg);
      throw new Error(msg);
    }
  }

  /** Canonical, sorted friendship doc id — must equal the rule's `userA + '__' + userB`. */
  private static friendshipDocId(u1: string, u2: string): string {
    const [a, b] = [u1, u2].sort();
    return `${a}__${b}`;
  }

  /** Directional block doc id — `blockerId__blockedId`, bound by the rule on create. */
  private static blockDocId(blockerId: string, blockedId: string): string {
    return `${blockerId}__${blockedId}`;
  }

  private toFriendProfile(uid: string, p?: PublicProfile | null): FriendProfile {
    if (p) {
      return {
        id: uid,
        displayName: p.displayName || 'Companion',
        handle: p.handle || '',
        photoURL: p.photoURL,
        bio: p.bio,
        // Real shared-experience aggregate is deferred; 0 is an honest placeholder.
        sharedExperienceCount: 0,
      };
    }
    return { id: uid, displayName: 'Companion', handle: '', sharedExperienceCount: 0 };
  }

  private async fetchFriendProfile(db: Firestore, uid: string): Promise<FriendProfile> {
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'public', 'profile'));
      return this.toFriendProfile(uid, snap.exists() ? (snap.data() as PublicProfile) : null);
    } catch (err) {
      logger.warn('Could not read public profile', { uid, err });
      return this.toFriendProfile(uid, null);
    }
  }

  // ─── Friendships ─────────────────────────────────────────────
  async getFriends(userId: string): Promise<FriendProfile[]> {
    const db = this.getDb();
    if (db) {
      const blocked = await this.getBlockedUserIds(userId);
      const col = collection(db, 'friendships');
      const [aSnap, bSnap] = await Promise.all([
        getDocs(query(col, where('userA', '==', userId), where('status', '==', 'accepted'), limit(200))),
        getDocs(query(col, where('userB', '==', userId), where('status', '==', 'accepted'), limit(200))),
      ]);
      const otherIds: string[] = [];
      const seen = new Set<string>();
      for (const d of [...aSnap.docs, ...bSnap.docs]) {
        const f = d.data() as Friendship;
        const other = f.userA === userId ? f.userB : f.userA;
        if (!seen.has(other) && !blocked.has(other)) {
          seen.add(other);
          otherIds.push(other);
        }
      }
      return Promise.all(otherIds.map(id => this.fetchFriendProfile(db, id)));
    }

    this.assertLocalAllowed('getFriends');
    const friends: FriendProfile[] = [];
    const blockedIds = await this.getBlockedUserIds(userId);

    this.localFriendships.forEach(f => {
      if (f.status === 'accepted' && (f.userA === userId || f.userB === userId)) {
        const otherId = f.userA === userId ? f.userB : f.userA;
        if (!blockedIds.has(otherId)) {
          const local = this.localProfiles.get(otherId);
          const mock = config.features.mockSocial ? MOCK_USERS_DB.find(u => u.id === otherId) : undefined;
          const profile: FriendProfile = local
            ? this.toFriendProfile(otherId, local)
            : mock || {
                id: otherId,
                displayName: otherId.replace('user_', '').replace('_', ' ').toUpperCase(),
                handle: `@${otherId}`,
                sharedExperienceCount: 1,
              };
          friends.push(profile);
        }
      }
    });

    // Empty-state fabrication is a mock affordance only.
    if (friends.length === 0 && config.features.mockSocial) {
      friends.push(MOCK_USERS_DB[0]);
    }

    return friends;
  }

  async getPendingRequests(userId: string): Promise<Friendship[]> {
    const db = this.getDb();
    if (db) {
      const blocked = await this.getBlockedUserIds(userId);
      const col = collection(db, 'friendships');
      const [aSnap, bSnap] = await Promise.all([
        getDocs(query(col, where('userA', '==', userId), where('status', '==', 'pending'), limit(100))),
        getDocs(query(col, where('userB', '==', userId), where('status', '==', 'pending'), limit(100))),
      ]);
      const out: Friendship[] = [];
      const seen = new Set<string>();
      for (const d of [...aSnap.docs, ...bSnap.docs]) {
        const f = d.data() as Friendship;
        if (seen.has(f.id)) continue;
        seen.add(f.id);
        const other = f.userA === userId ? f.userB : f.userA;
        // Incoming requests only: I am a party but NOT the requester, and I have not
        // blocked the requester. (Correctly handles sorted ids where I may be userA.)
        if (f.requestedBy !== userId && !blocked.has(other)) out.push(f);
      }
      return out;
    }

    this.assertLocalAllowed('getPendingRequests');
    const pending: Friendship[] = [];
    const blockedIds = await this.getBlockedUserIds(userId);
    this.localFriendships.forEach(f => {
      const isParty = f.userA === userId || f.userB === userId;
      const other = f.userA === userId ? f.userB : f.userA;
      if (f.status === 'pending' && isParty && f.requestedBy !== userId && !blockedIds.has(other)) {
        pending.push(f);
      }
    });
    return pending;
  }

  async sendFriendRequest(fromUserId: string, toUserId: string): Promise<Friendship> {
    if (await this.isBlockedBetween(fromUserId, toUserId)) {
      throw new Error('Action not permitted due to safety block.');
    }

    const db = this.getDb();
    const now = new Date().toISOString();
    const [userA, userB] = [fromUserId, toUserId].sort();

    if (db) {
      const id = SocialRepository.friendshipDocId(fromUserId, toUserId);
      const ref = doc(db, 'friendships', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const f = snap.data() as Friendship;
        if (f.status === 'accepted' || f.status === 'pending') return f;
        // Re-open a previously declined/removed request. The rule freezes
        // requestedBy, so we do not resend it.
        try {
          await updateDoc(ref, { status: 'pending', updatedAt: now });
        } catch (err) {
          logger.error('Failed to re-open friend request', err);
          throw err;
        }
        return { ...f, status: 'pending', updatedAt: now };
      }
      const friendship: Friendship = {
        id,
        userA,
        userB,
        status: 'pending',
        requestedBy: fromUserId,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await setDoc(ref, friendship);
      } catch (err) {
        logger.error('Failed to send friend request', err);
        throw err;
      }
      logger.info('Friend request sent', { id });
      return friendship;
    }

    this.assertLocalAllowed('sendFriendRequest');
    const friendshipId = `friend_${userA}_${userB}`;
    const existing = this.localFriendships.get(friendshipId);
    if (existing && existing.status === 'accepted') {
      return existing;
    }
    const friendship: Friendship = {
      id: friendshipId,
      userA,
      userB,
      status: 'pending',
      requestedBy: fromUserId,
      createdAt: now,
      updatedAt: now,
    };
    this.localFriendships.set(friendshipId, friendship);
    logger.info('Friend request sent', { friendshipId });
    return friendship;
  }

  async acceptFriendRequest(friendshipId: string): Promise<void> {
    const db = this.getDb();
    if (db) {
      try {
        await updateDoc(doc(db, 'friendships', friendshipId), {
          status: 'accepted',
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        logger.error('Failed to accept friend request', err);
        throw err;
      }
      return;
    }
    this.assertLocalAllowed('acceptFriendRequest');
    const existing = this.localFriendships.get(friendshipId);
    if (existing) {
      existing.status = 'accepted';
      existing.updatedAt = new Date().toISOString();
    }
  }

  async declineFriendRequest(friendshipId: string): Promise<void> {
    const db = this.getDb();
    if (db) {
      try {
        await updateDoc(doc(db, 'friendships', friendshipId), {
          status: 'declined',
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        logger.error('Failed to decline friend request', err);
        throw err;
      }
      return;
    }
    this.assertLocalAllowed('declineFriendRequest');
    const existing = this.localFriendships.get(friendshipId);
    if (existing) {
      existing.status = 'declined';
      existing.updatedAt = new Date().toISOString();
    }
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();
    if (db) {
      const id = SocialRepository.friendshipDocId(userId, friendId);
      try {
        await updateDoc(doc(db, 'friendships', id), { status: 'removed', updatedAt: now });
      } catch (err) {
        logger.error('Failed to remove friend', err);
        throw err;
      }
      return;
    }
    this.assertLocalAllowed('removeFriend');
    const [userA, userB] = [userId, friendId].sort();
    const friendshipId = `friend_${userA}_${userB}`;
    const existing = this.localFriendships.get(friendshipId);
    if (existing) {
      existing.status = 'removed';
      existing.updatedAt = now;
    }
  }

  async searchUserByHandle(handleQuery: string, currentUserId: string): Promise<FriendProfile | null> {
    const normalized = handleQuery.trim().toLowerCase().replace('@', '');
    if (!normalized) return null;

    const db = this.getDb();
    if (db) {
      try {
        const claim = await getDoc(doc(db, 'handles', normalized));
        if (!claim.exists()) return null;
        const { uid } = claim.data() as HandleClaim;
        if (!uid || uid === currentUserId) return null;
        const blocked = await this.getBlockedUserIds(currentUserId);
        if (blocked.has(uid)) return null;
        return await this.fetchFriendProfile(db, uid);
      } catch (err) {
        logger.warn('Handle search failed', { err });
        return null;
      }
    }

    this.assertLocalAllowed('searchUserByHandle');
    const blocked = await this.getBlockedUserIds(currentUserId);

    // Real local handle registry (profiles saved this session).
    const localUid = this.localHandles.get(normalized);
    if (localUid && localUid !== currentUserId && !blocked.has(localUid)) {
      const p = this.localProfiles.get(localUid);
      if (p) return this.toFriendProfile(localUid, p);
    }

    // Fabricated matches are a dev-only mock affordance.
    if (config.features.mockSocial) {
      const found = MOCK_USERS_DB.find(u => u.handle.toLowerCase().replace('@', '') === normalized);
      if (found && !blocked.has(found.id)) return found;
      if (normalized.length >= 3) {
        const dynamicId = `user_${normalized}`;
        if (blocked.has(dynamicId)) return null;
        return {
          id: dynamicId,
          displayName: normalized.charAt(0).toUpperCase() + normalized.slice(1),
          handle: `@${normalized}`,
          bio: 'Explorer in the Extrovela community.',
          sharedExperienceCount: 0,
        };
      }
    }

    return null;
  }

  // ─── Public profile, handles & privacy ───────────────────────
  async savePublicProfile(profile: PublicProfile): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();
    if (db) {
      try {
        await setDoc(
          doc(db, 'users', profile.uid, 'public', 'profile'),
          { ...profile, updatedAt: now },
          { merge: true }
        );
      } catch (err) {
        logger.error('Failed to save public profile', err);
        throw err;
      }
      // Claim the handle. The rule is create-only (first-writer-wins, unstealable):
      // if two users race, one create is denied by the rule and we surface it.
      const hLower = profile.handleLower;
      try {
        const hSnap = await getDoc(doc(db, 'handles', hLower));
        if (!hSnap.exists()) {
          await setDoc(doc(db, 'handles', hLower), { uid: profile.uid, handleLower: hLower, claimedAt: now });
        } else if ((hSnap.data() as HandleClaim).uid !== profile.uid) {
          throw new Error('That handle is already taken.');
        }
      } catch (err) {
        logger.error('Handle claim failed', err);
        throw err instanceof Error ? err : new Error('That handle is unavailable.');
      }
      return;
    }
    this.assertLocalAllowed('savePublicProfile');
    const existingOwner = this.localHandles.get(profile.handleLower);
    if (existingOwner && existingOwner !== profile.uid) {
      throw new Error('That handle is already taken.');
    }
    this.localProfiles.set(profile.uid, { ...profile, updatedAt: now });
    this.localHandles.set(profile.handleLower, profile.uid);
  }

  async getPublicProfile(uid: string): Promise<PublicProfile | null> {
    const db = this.getDb();
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'public', 'profile'));
        return snap.exists() ? (snap.data() as PublicProfile) : null;
      } catch (err) {
        logger.warn('Failed to read public profile', { uid, err });
        return null;
      }
    }
    this.assertLocalAllowed('getPublicProfile');
    return this.localProfiles.get(uid) || null;
  }

  async getPrivacySettings(uid: string): Promise<SocialPrivacySettings> {
    const db = this.getDb();
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'settings', 'privacy'));
        return snap.exists()
          ? ({ ...DEFAULT_SOCIAL_PRIVACY, ...(snap.data() as SocialPrivacySettings) })
          : { ...DEFAULT_SOCIAL_PRIVACY };
      } catch (err) {
        logger.warn('Failed to read privacy settings', { uid, err });
        return { ...DEFAULT_SOCIAL_PRIVACY };
      }
    }
    this.assertLocalAllowed('getPrivacySettings');
    return this.localPrivacy.get(uid) || { ...DEFAULT_SOCIAL_PRIVACY };
  }

  async savePrivacySettings(uid: string, settings: SocialPrivacySettings): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();
    if (db) {
      try {
        await setDoc(doc(db, 'users', uid, 'settings', 'privacy'), { ...settings, updatedAt: now }, { merge: true });
      } catch (err) {
        logger.error('Failed to save privacy settings', err);
        throw err;
      }
      return;
    }
    this.assertLocalAllowed('savePrivacySettings');
    this.localPrivacy.set(uid, { ...settings, updatedAt: now });
  }

  // ─── Trust & Safety: Blocks & Reports ────────────────────────
  async blockUser(blockerId: string, blockedId: string): Promise<UserBlock> {
    const db = this.getDb();
    const now = new Date().toISOString();
    const id = db ? SocialRepository.blockDocId(blockerId, blockedId) : `block_${blockerId}_${blockedId}`;
    const block: UserBlock = { id, blockerId, blockedId, createdAt: now };

    if (db) {
      try {
        await setDoc(doc(db, 'userBlocks', id), block);
      } catch (err) {
        logger.error('Failed to block user', err);
        throw err;
      }
      // Best-effort: reflect the block on an existing friendship (non-fatal — the
      // authoritative safety boundary is the userBlocks doc + the rules' exists() checks).
      try {
        const fid = SocialRepository.friendshipDocId(blockerId, blockedId);
        const fref = doc(db, 'friendships', fid);
        const fsnap = await getDoc(fref);
        if (fsnap.exists()) await updateDoc(fref, { status: 'blocked', updatedAt: now });
      } catch (err) {
        logger.warn('Could not mark friendship blocked (non-fatal)', { err });
      }
      logger.info('User blocked', { id });
      return block;
    }

    this.assertLocalAllowed('blockUser');
    this.localBlocks.set(id, block);
    const [userA, userB] = [blockerId, blockedId].sort();
    const friendshipId = `friend_${userA}_${userB}`;
    const existing = this.localFriendships.get(friendshipId);
    if (existing) {
      existing.status = 'blocked';
      existing.updatedAt = now;
    }
    logger.info('User blocked', { id });
    return block;
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const db = this.getDb();
    if (db) {
      try {
        await deleteDoc(doc(db, 'userBlocks', SocialRepository.blockDocId(blockerId, blockedId)));
      } catch (err) {
        logger.error('Failed to unblock user', err);
        throw err;
      }
      return;
    }
    this.assertLocalAllowed('unblockUser');
    this.localBlocks.delete(`block_${blockerId}_${blockedId}`);
  }

  async reportUser(report: Omit<UserReport, 'id' | 'createdAt' | 'status'>): Promise<UserReport> {
    const db = this.getDb();
    const now = new Date().toISOString();
    if (db) {
      const payload = { ...report, status: 'pending' as const, createdAt: now };
      try {
        const ref = await addDoc(collection(db, 'reports'), payload);
        logger.warn('User report submitted', { reportId: ref.id, reason: report.reason });
        return { ...payload, id: ref.id };
      } catch (err) {
        logger.error('Failed to submit report', err);
        throw err;
      }
    }
    this.assertLocalAllowed('reportUser');
    const reportId = `report_${Date.now()}`;
    const fullReport: UserReport = { ...report, id: reportId, status: 'pending', createdAt: now };
    this.localReports.push(fullReport);
    logger.warn('User report submitted', { reportId, reason: report.reason });
    return fullReport;
  }

  /**
   * Best-effort, defense-in-depth block check. Authoritative bidirectional
   * enforcement lives in the Security Rules (exists() on BOTH directional block
   * docs). Client-side we can only read blocks we own, so a direction we cannot
   * read is treated as "not blocked from my side" and left to the rules.
   */
  async isBlockedBetween(user1: string, user2: string): Promise<boolean> {
    const db = this.getDb();
    if (db) {
      const readOwn = async (blocker: string, blocked: string): Promise<boolean> => {
        try {
          const s = await getDoc(doc(db, 'userBlocks', SocialRepository.blockDocId(blocker, blocked)));
          return s.exists();
        } catch {
          // Rules deny reading a block doc I don't own → unknown from my side.
          return false;
        }
      };
      const [a, b] = await Promise.all([readOwn(user1, user2), readOwn(user2, user1)]);
      return a || b;
    }
    for (const bl of this.localBlocks.values()) {
      if (
        (bl.blockerId === user1 && bl.blockedId === user2) ||
        (bl.blockerId === user2 && bl.blockedId === user1)
      ) {
        return true;
      }
    }
    return false;
  }

  private async getBlockedUserIds(userId: string): Promise<Set<string>> {
    const set = new Set<string>();
    const db = this.getDb();
    if (db) {
      // Only blocks I created are client-readable (userBlocks is blocker-only). Used
      // to filter people I've blocked out of my own lists/search.
      try {
        const snap = await getDocs(query(collection(db, 'userBlocks'), where('blockerId', '==', userId), limit(500)));
        snap.docs.forEach(d => set.add((d.data() as UserBlock).blockedId));
      } catch (err) {
        logger.warn('Failed to load block list', { err });
      }
      return set;
    }
    for (const b of this.localBlocks.values()) {
      if (b.blockerId === userId) set.add(b.blockedId);
      if (b.blockedId === userId) set.add(b.blockerId);
    }
    return set;
  }

  // ─── Quest Invites ───────────────────────────────────────────
  async saveQuestInvite(invite: QuestInvite): Promise<void> {
    const db = this.getDb();
    if (db) {
      // Doc id IS the secure token (mirrors shareLinks/{token}): lookup is a direct
      // getDoc, no query, no enumeration.
      try {
        await setDoc(doc(db, 'questInvites', invite.inviteToken), invite);
      } catch (err) {
        logger.error('Failed to save quest invite', err);
        throw err;
      }
      return;
    }
    this.assertLocalAllowed('saveQuestInvite');
    this.localInvites.set(invite.id, invite);
    this.localInvites.set(`token_${invite.inviteToken}`, invite);
  }

  async getQuestInvite(inviteId: string): Promise<QuestInvite | null> {
    const db = this.getDb();
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'questInvites', inviteId));
        return snap.exists() ? (snap.data() as QuestInvite) : null;
      } catch (err) {
        logger.warn('Failed to read quest invite', { err });
        return null;
      }
    }
    this.assertLocalAllowed('getQuestInvite');
    return this.localInvites.get(inviteId) || null;
  }

  async getInviteByToken(token: string): Promise<QuestInvite | null> {
    const db = this.getDb();
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'questInvites', token));
        return snap.exists() ? (snap.data() as QuestInvite) : null;
      } catch (err) {
        logger.warn('Failed to read quest invite by token', { err });
        return null;
      }
    }
    this.assertLocalAllowed('getInviteByToken');
    return this.localInvites.get(`token_${token}`) || null;
  }

  async cancelInvite(inviteId: string): Promise<void> {
    const db = this.getDb();
    if (db) {
      try {
        await updateDoc(doc(db, 'questInvites', inviteId), {
          status: 'cancelled',
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        logger.error('Failed to cancel invite', err);
        throw err;
      }
      return;
    }
    this.assertLocalAllowed('cancelInvite');
    const inv = this.localInvites.get(inviteId);
    if (inv) {
      inv.status = 'cancelled';
      inv.updatedAt = new Date().toISOString();
    }
  }

  // ─── Group Quest Sessions ────────────────────────────────────
  async saveGroupSession(session: GroupQuestSession): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();
    if (db) {
      const participantIds =
        session.participantIds && session.participantIds.length
          ? session.participantIds
          : session.participants.map(p => p.userId);
      const sessionDoc = {
        id: session.id,
        questId: session.questId,
        creatorId: session.creatorId,
        state: session.state,
        participantIds,
        startedAt: session.startedAt ?? null,
        completedAt: session.completedAt ?? null,
        sharedExperienceId: session.sharedExperienceId ?? null,
        updatedAt: now,
      };
      try {
        await setDoc(doc(db, 'groupQuestSessions', session.id), sessionDoc, { merge: true });
        // Bootstrap the creator's authoritative OWNER membership row.
        const creator = session.participants.find(p => p.userId === session.creatorId);
        await setDoc(
          doc(db, 'groupQuestSessions', session.id, 'members', session.creatorId),
          {
            uid: session.creatorId,
            role: 'OWNER',
            status: 'active',
            displayName: creator?.displayName ?? '',
            joinedAt: now,
            updatedAt: now,
          },
          { merge: true }
        );
      } catch (err) {
        logger.error('Failed to save group session', err);
        throw err;
      }
      return;
    }
    this.assertLocalAllowed('saveGroupSession');
    this.localSessions.set(session.id, session);
  }

  async getGroupSession(sessionId: string): Promise<GroupQuestSession | null> {
    const db = this.getDb();
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'groupQuestSessions', sessionId));
        if (!snap.exists()) return null;
        const data = snap.data() as Record<string, any>;
        const memSnap = await getDocs(query(collection(db, 'groupQuestSessions', sessionId, 'members'), limit(12)));
        const participants: QuestParticipant[] = memSnap.docs.map(d => {
          const m = d.data() as GroupMember;
          return {
            id: `part_${m.uid}`,
            questId: data.questId,
            userId: m.uid,
            displayName: m.displayName ?? '',
            role: m.role === 'OWNER' ? 'creator' : 'participant',
            status: (m.status === 'active' ? 'active' : m.status) as QuestParticipant['status'],
            joinedAt: m.joinedAt ?? new Date().toISOString(),
          };
        });
        return {
          id: sessionId,
          questId: data.questId,
          creatorId: data.creatorId,
          state: data.state,
          participants,
          participantIds: data.participantIds ?? [],
          startedAt: data.startedAt ?? undefined,
          completedAt: data.completedAt ?? undefined,
          sharedExperienceId: data.sharedExperienceId ?? undefined,
        };
      } catch (err) {
        logger.warn('Failed to read group session', { err });
        return null;
      }
    }
    this.assertLocalAllowed('getGroupSession');
    return this.localSessions.get(sessionId) || null;
  }

  /**
   * OWNER/ADMIN invites a third party. Creates their membership row as an INVITED
   * MEMBER — the invitee accepts later (invite-then-accept; no self-join path).
   */
  async inviteSessionMember(
    sessionId: string,
    inviterUid: string,
    invitee: { uid: string; displayName?: string }
  ): Promise<GroupMember> {
    if (await this.isBlockedBetween(inviterUid, invitee.uid)) {
      throw new Error('Cannot invite a blocked user.');
    }
    const db = this.getDb();
    const now = new Date().toISOString();
    const member: GroupMember = {
      uid: invitee.uid,
      role: 'MEMBER',
      status: 'invited',
      displayName: invitee.displayName ?? '',
      invitedBy: inviterUid,
      joinedAt: now,
      updatedAt: now,
    };
    if (db) {
      try {
        await setDoc(doc(db, 'groupQuestSessions', sessionId, 'members', invitee.uid), member);
        const sref = doc(db, 'groupQuestSessions', sessionId);
        const ssnap = await getDoc(sref);
        if (ssnap.exists()) {
          const ids = new Set<string>([...(((ssnap.data() as any).participantIds as string[]) ?? []), invitee.uid]);
          await updateDoc(sref, { participantIds: [...ids], updatedAt: now });
        }
      } catch (err) {
        logger.error('Failed to invite session member', err);
        throw err;
      }
      return member;
    }
    this.assertLocalAllowed('inviteSessionMember');
    const session = this.localSessions.get(sessionId);
    if (session && !session.participants.some(p => p.userId === invitee.uid)) {
      session.participants.push({
        id: `part_${invitee.uid}`,
        questId: session.questId,
        userId: invitee.uid,
        displayName: invitee.displayName ?? '',
        role: 'participant',
        status: 'invited',
        joinedAt: now,
      });
    }
    return member;
  }

  async setSessionMembership(sessionId: string, uid: string, status: 'active' | 'declined' | 'left'): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();
    if (db) {
      try {
        // NOTE: role is intentionally omitted — the invitee can never change it.
        await updateDoc(doc(db, 'groupQuestSessions', sessionId, 'members', uid), { status, updatedAt: now });
      } catch (err) {
        logger.error('Failed to update session membership', err);
        throw err;
      }
      return;
    }
    this.assertLocalAllowed('setSessionMembership');
    const session = this.localSessions.get(sessionId);
    const p = session?.participants.find(pp => pp.userId === uid);
    if (p) p.status = status === 'active' ? 'active' : status === 'declined' ? 'declined' : 'left';
  }

  async setMemberRole(sessionId: string, targetUid: string, role: Extract<GroupRole, 'ADMIN' | 'MEMBER'>): Promise<void> {
    const db = this.getDb();
    const now = new Date().toISOString();
    if (db) {
      try {
        await updateDoc(doc(db, 'groupQuestSessions', sessionId, 'members', targetUid), { role, updatedAt: now });
      } catch (err) {
        logger.error('Failed to update member role', err);
        throw err;
      }
      return;
    }
    this.assertLocalAllowed('setMemberRole');
    // Embedded local model has no ADMIN tier; no-op beyond keeping the row present.
  }

  async getSessionMembers(sessionId: string): Promise<GroupMember[]> {
    const db = this.getDb();
    if (db) {
      try {
        const snap = await getDocs(query(collection(db, 'groupQuestSessions', sessionId, 'members'), limit(12)));
        return snap.docs.map(d => d.data() as GroupMember);
      } catch (err) {
        logger.warn('Failed to read session members', { err });
        return [];
      }
    }
    this.assertLocalAllowed('getSessionMembers');
    const session = this.localSessions.get(sessionId);
    if (!session) return [];
    return session.participants.map(p => ({
      uid: p.userId,
      role: p.role === 'creator' ? 'OWNER' : 'MEMBER',
      status: (p.status === 'active' ? 'active' : p.status === 'invited' ? 'invited' : 'active') as GroupMember['status'],
      displayName: p.displayName,
      joinedAt: p.joinedAt,
    }));
  }

  // ─── Shared Experiences ──────────────────────────────────────
  async saveSharedExperience(exp: SharedExperience): Promise<void> {
    const db = this.getDb();
    if (db) {
      // Immutable co-completion record; the rule forbids update/delete.
      try {
        await setDoc(doc(db, 'sharedExperiences', exp.id), exp);
        logger.info('Shared experience saved', { expId: exp.id, participants: exp.participantIds.length });
      } catch (err) {
        logger.error('Failed to save shared experience', err);
        throw err;
      }
      return;
    }
    this.assertLocalAllowed('saveSharedExperience');
    logger.info('Saved shared experience (local)', { expId: exp.id, participants: exp.participantIds.length });
  }

  /** Recent shared experiences I took part in (uses the participantIds CONTAINS index). */
  async getSharedExperiences(userId: string, max = 20): Promise<SharedExperience[]> {
    const db = this.getDb();
    if (db) {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'sharedExperiences'),
            where('participantIds', 'array-contains', userId),
            orderBy('completedAt', 'desc'),
            limit(max)
          )
        );
        return snap.docs.map(d => d.data() as SharedExperience);
      } catch (err) {
        logger.warn('Failed to read shared experiences', { err });
        return [];
      }
    }
    // Local-first mode does not persist shared experiences (completion is logged
    // only), so there is nothing to enumerate here.
    this.assertLocalAllowed('getSharedExperiences');
    return [];
  }
}

export const socialRepository = new SocialRepository();
export default socialRepository;
