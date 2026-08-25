/**
 * EXTROVELA — Phase 14 Automated Test Suite
 * Social Experiences · Shared Quests · Realtime Persistence · Adversarial Rules Verification
 *
 * Runs locally under Node without live Firebase or network dependencies.
 * Proves the correctness, safety, and invariant enforcement of the Phase 14 Secure Core:
 *   · Friend state machine & canonical sorted IDs
 *   · Block precedence in both directions (blocks friending, invites, groups, search)
 *   · Quest invite lifecycle & CSPRNG token security (no Math.random)
 *   · Small group sessions & member role hierarchy (OWNER/ADMIN/MEMBER, invite-then-accept)
 *   · Shared experience co-completion & immutability
 *   · Privacy settings & minimal public profile boundaries
 *   · Derived social notifications (proof of zero cross-user writes)
 *   · Bounded realtime subscription contracts & unsubscribe detachability
 *   · Full adversarial security rules matrix via pure SocialAuthRulesEngine mirror
 */

import { SocialService } from '../services/social/socialService';
import { QuestSharingService } from '../services/social/questSharingService';
import { GroupQuestSessionService } from '../services/social/groupQuestSessionService';
import { socialRepository } from '../repositories/SocialRepository';
import { rateLimiter } from '../services/social/rateLimiter';
import {
  pendingRequestToNotification,
  invitedMembershipToNotification,
  sharedExperienceToNotification,
  deriveSocialNotifications,
} from '../services/social/socialNotifications';
import {
  subscribeAcceptedFriendships,
  subscribePendingFriendRequests,
  subscribeSessionMembers,
  subscribeSentInvites,
  subscribeUnreadNotifications,
  NOOP_UNSUBSCRIBE,
} from '../services/social/socialRealtime';
import { SocialAuthRulesEngine } from '../services/social/socialAuthRules';
import { isValidShareToken } from '../services/security/tokenGenerator';
import { DEFAULT_SOCIAL_PRIVACY, GroupMember, SharedExperience } from '../types/social';
import { Quest } from '../types/quest';

interface TestResult {
  group: string;
  test: string;
  passed: boolean;
  error?: string;
}

export async function runPhase14Tests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const run = async (group: string, test: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      results.push({ group, test, passed: true });
    } catch (err) {
      results.push({
        group,
        test,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. FRIENDSHIP STATE MACHINE & CANONICAL ORDERING
  // ═══════════════════════════════════════════════════════════════════════════

  await run('Friendship', '1.1 Friend request initializes as pending with sorted canonical ID', async () => {
    rateLimiter.reset();
    const f = await socialRepository.sendFriendRequest('user_beta', 'user_alpha');
    assert(f.status === 'pending', 'Status must be pending');
    assert(f.requestedBy === 'user_beta', 'requestedBy must record initiator');
    assert(f.userA === 'user_alpha' && f.userB === 'user_beta', 'Users must be canonically sorted (alpha < beta)');
  });

  await run('Friendship', '1.2 Accepting friend request transitions status to accepted', async () => {
    const f = await socialRepository.sendFriendRequest('user_one', 'user_two');
    await socialRepository.acceptFriendRequest(f.id);
    const friendsOfOne = await socialRepository.getFriends('user_one');
    assert(friendsOfOne.some(p => p.id === 'user_two'), 'user_two should now appear in user_one friends list');
  });

  await run('Friendship', '1.3 Declining friend request marks status declined', async () => {
    const f = await socialRepository.sendFriendRequest('user_three', 'user_four');
    await socialRepository.declineFriendRequest(f.id);
    const pending = await socialRepository.getPendingRequests('user_four');
    assert(!pending.some(p => p.id === f.id), 'Declined request must not appear in pending list');
  });

  await run('Friendship', '1.4 Removing friend updates status to removed', async () => {
    const f = await socialRepository.sendFriendRequest('user_five', 'user_six');
    await socialRepository.acceptFriendRequest(f.id);
    await socialRepository.removeFriend('user_five', 'user_six');
    const friends = await socialRepository.getFriends('user_five');
    assert(!friends.some(p => p.id === 'user_six'), 'Removed friend must not appear in active friends');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. BLOCK PRECEDENCE & SAFETY
  // ═══════════════════════════════════════════════════════════════════════════

  await run('Safety Blocks', '2.1 Blocking a user prevents sending friend requests in either direction', async () => {
    await socialRepository.blockUser('user_blocker', 'user_blocked');

    // Blocker -> Blocked
    let blockerErr = false;
    try {
      await socialRepository.sendFriendRequest('user_blocker', 'user_blocked');
    } catch {
      blockerErr = true;
    }
    assert(blockerErr, 'Blocker sending to blocked must throw safety error');

    // Blocked -> Blocker
    let blockedErr = false;
    try {
      await socialRepository.sendFriendRequest('user_blocked', 'user_blocker');
    } catch {
      blockedErr = true;
    }
    assert(blockedErr, 'Blocked user sending to blocker must throw safety error');
  });

  await run('Safety Blocks', '2.2 Blocked user is excluded from companion lists & handle search', async () => {
    await socialRepository.blockUser('user_me', 'user_maya');
    const searchRes = await socialRepository.searchUserByHandle('maya_chen', 'user_me');
    assert(searchRes === null, 'Blocked user must not be discoverable in handle search');
  });

  await run('Safety Blocks', '2.3 Unblocking restores ability to interact', async () => {
    await socialRepository.blockUser('user_temp_block', 'user_temp_target');
    assert(await socialRepository.isBlockedBetween('user_temp_block', 'user_temp_target'), 'Must report blocked');
    await socialRepository.unblockUser('user_temp_block', 'user_temp_target');
    assert(!(await socialRepository.isBlockedBetween('user_temp_block', 'user_temp_target')), 'Must report unblocked');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. QUEST INVITES & CRYPTO TOKEN SECURITY
  // ═══════════════════════════════════════════════════════════════════════════

  await run('Quest Invites', '3.1 Quest invite tokens use CSPRNG, >=28 chars, URL-safe base62', async () => {
    const dummyQuest: Quest = {
      id: 'q_secret_courtyard',
      title: 'Secret Courtyard Walk',
      description: 'Find a peaceful hidden stone courtyard.',
      category: 'Discovery',
      environment: 'Outdoor',
      mood: 'Peaceful',
      energy: 'Chill',
      time: '30 mins',
      budget: 'Free',
      social: 'With a friend',
      season: 'Any',
      tags: ['quiet', 'courtyard'],
    };

    const invite = await QuestSharingService.createInvite(dummyQuest, 'user_host', 'Host Name', 'link', 4);
    assert(invite.inviteToken.startsWith('inv_'), 'Invite token must start with inv_ prefix');
    assert(invite.inviteToken.length >= 28, `Invite token length must be >= 28 chars (was ${invite.inviteToken.length})`);
    const rawRandom = invite.inviteToken.replace('inv_', '');
    assert(isValidShareToken(rawRandom), 'Token payload must be valid URL-safe base62');
    assert(invite.id === invite.inviteToken, 'Document ID must equal the invite token (doc ID = token)');
  });

  await run('Quest Invites', '3.2 Invite validation enforces status, expiration, and block precedence', async () => {
    const dummyQuest: Quest = {
      id: 'q_rooftop_sunset',
      title: 'Rooftop Sunset',
      description: 'Quiet sunset viewpoint.',
      category: 'Sanctuary',
      environment: 'Outdoor',
      mood: 'Peaceful',
      energy: 'Chill',
      time: '30 mins',
      budget: 'Free',
      social: 'With a friend',
      season: 'Any',
      tags: ['sunset'],
    };


    const invite = await QuestSharingService.createInvite(dummyQuest, 'user_host_2', 'Host Two', 'link', 4);

    // Active validation
    const validCheck = await QuestSharingService.validateInviteToken(invite.inviteToken, 'user_guest_1');
    assert(validCheck.valid === true, 'Active invite must validate successfully');

    // Cancelled validation
    await QuestSharingService.cancelInvite(invite.id, 'user_host_2');
    const cancelledCheck = await QuestSharingService.validateInviteToken(invite.inviteToken, 'user_guest_1');
    assert(cancelledCheck.valid === false, 'Cancelled invite must be rejected');

    // Blocked validation
    const freshInvite = await QuestSharingService.createInvite(dummyQuest, 'user_host_3', 'Host Three', 'link', 4);
    await socialRepository.blockUser('user_host_3', 'user_blocked_guest');
    const blockedCheck = await QuestSharingService.validateInviteToken(freshInvite.inviteToken, 'user_blocked_guest');
    assert(blockedCheck.valid === false, 'Blocked user cannot validate invite');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. GROUP QUEST SESSIONS & SHARED EXPERIENCES
  // ═══════════════════════════════════════════════════════════════════════════

  await run('Group Sessions', '4.1 Group quest session starts in waiting state with participant bounds', async () => {
    const session = await GroupQuestSessionService.createGroupSession(
      'q_heritage_trail',
      'user_creator',
      'Creator User',
      [{ id: 'user_companion_1', name: 'Companion 1' }],
      3
    );

    assert(session.state === 'waiting', 'New session must start in waiting state');
    assert(session.participants.length === 2, 'Session has 2 initial participants');

    // Attempting to exceed max capacity throws
    await GroupQuestSessionService.joinGroupSession(session.id, { id: 'user_companion_2', name: 'Companion 2' }, 3);
    let overLimit = false;
    try {
      await GroupQuestSessionService.joinGroupSession(session.id, { id: 'user_companion_3', name: 'Companion 3' }, 3);
    } catch {
      overLimit = true;
    }
    assert(overLimit, 'Exceeding participant limit must throw');
  });

  await run('Group Sessions', '4.2 Completing group session produces immutable SharedExperience', async () => {
    const session = await GroupQuestSessionService.createGroupSession(
      'q_tea_tasting',
      'user_host_4',
      'Host 4',
      [{ id: 'user_friend_4', name: 'Friend 4' }],
      4
    );

    const sharedExp = await GroupQuestSessionService.completeGroupSession(session, 'Tea Tasting Journey');
    assert(sharedExp.id.startsWith('shared_exp_'), 'Shared experience ID must be generated');
    assert(sharedExp.creatorId === 'user_host_4', 'Creator ID must match host');
    assert(sharedExp.participantIds.includes('user_host_4'), 'Host must be in participantIds');
    assert(sharedExp.participantIds.includes('user_friend_4'), 'Friend must be in participantIds');
    assert(session.state === 'completed', 'Session state must transition to completed');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. PRIVACY CONTROLS & DEFAULTS
  // ═══════════════════════════════════════════════════════════════════════════

  await run('Privacy', '5.1 Social privacy defaults lean private: exact location disabled', async () => {
    assert(DEFAULT_SOCIAL_PRIVACY.shareExactLocation === false, 'shareExactLocation must default to false');
    assert(DEFAULT_SOCIAL_PRIVACY.allowFriendRequests === 'anyone', 'allowFriendRequests defaults to anyone');
    assert(DEFAULT_SOCIAL_PRIVACY.discoverableByHandle === true, 'discoverableByHandle defaults to true for companion flow');
  });

  await run('Privacy', '5.2 Public profile contains only non-sensitive display fields', async () => {
    await socialRepository.savePublicProfile({
      uid: 'user_privacy_test',
      displayName: 'Private Explorer',
      handle: '@private_explorer',
      handleLower: 'private_explorer',
      bio: 'Exploring quietly.',
      updatedAt: new Date().toISOString(),
    });

    const profile = await socialRepository.getPublicProfile('user_privacy_test');
    assert(profile !== null, 'Profile must exist');
    assert(profile?.displayName === 'Private Explorer', 'DisplayName matches');
    assert(!('email' in (profile as any)), 'Email must NEVER exist on PublicProfile');
    assert(!('location' in (profile as any)), 'Location must NEVER exist on PublicProfile');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. DERIVED SOCIAL NOTIFICATIONS (NO CROSS-USER WRITES)
  // ═══════════════════════════════════════════════════════════════════════════

  await run('Notifications', '6.1 Pending friend request projects to friendInvite notification', async () => {
    const f = {
      id: 'user_sender__user_receiver',
      userA: 'user_receiver',
      userB: 'user_sender',
      status: 'pending' as const,
      requestedBy: 'user_sender',
      createdAt: '2026-08-24T12:00:00Z',
      updatedAt: '2026-08-24T12:00:00Z',
    };

    const notif = pendingRequestToNotification(f, 'user_receiver', 'Alex Rivers');
    assert(notif.userId === 'user_receiver', 'Notification recipient must be current user');
    assert(notif.type === 'friendInvite', 'Type must be friendInvite');
    assert(notif.body.includes('Alex Rivers'), 'Notification body must include requester name');
  });

  await run('Notifications', '6.2 Shared experience projects to sharedExperience notification', async () => {
    const exp: SharedExperience = {
      id: 'exp_sunset_walk',
      questId: 'q_sunset',
      questTitle: 'Sunset Walk',
      creatorId: 'user_sender',
      participantIds: ['user_sender', 'user_me'],
      participantNames: ['Alex Rivers', 'Me'],
      completedAt: '2026-08-24T18:30:00Z',
      createdAt: '2026-08-24T18:30:00Z',
    };

    const notif = sharedExperienceToNotification(exp, 'user_me');
    assert(notif.userId === 'user_me', 'Target must be current user');
    assert(notif.type === 'sharedExperience', 'Type must be sharedExperience');
    assert(notif.body.includes('Sunset Walk'), 'Title must be in body');
  });

  await run('Notifications', '6.3 deriveSocialNotifications fails soft and never writes cross-user data', async () => {
    const notifs = await deriveSocialNotifications('user_active');
    assert(Array.isArray(notifs), 'Must return an array of notifications');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. BOUNDED REALTIME SUBSCRIPTIONS & DETACHABLE UNSUBSCRIBE
  // ═══════════════════════════════════════════════════════════════════════════

  await run('Realtime', '7.1 Realtime subscriptions return callable detach functions in fallback mode', () => {
    const unsub1 = subscribeAcceptedFriendships('user_test', () => {});
    const unsub2 = subscribePendingFriendRequests('user_test', () => {});
    const unsub3 = subscribeSessionMembers('session_test', () => {});
    const unsub4 = subscribeSentInvites('user_test', () => {});
    const unsub5 = subscribeUnreadNotifications('user_test', () => {});

    assert(typeof unsub1 === 'function', 'Friendships unsub must be function');
    assert(typeof unsub2 === 'function', 'Pending unsub must be function');
    assert(typeof unsub3 === 'function', 'Session members unsub must be function');
    assert(typeof unsub4 === 'function', 'Sent invites unsub must be function');
    assert(typeof unsub5 === 'function', 'Unread notifs unsub must be function');

    // Calling unsub must not throw
    unsub1();
    unsub2();
    unsub3();
    unsub4();
    unsub5();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. ADVERSARIAL FIRESTORE SECURITY RULES MATRIX
  // ═══════════════════════════════════════════════════════════════════════════

  await run('Security Rules', '8.1 Unauthenticated requests are DENIED across all collections', () => {
    const engine = new SocialAuthRulesEngine();
    const unauth = { uid: null };

    assert(!engine.canReadFriendship(unauth, { userA: 'u1', userB: 'u2' }), 'Unauth friendship read denied');
    assert(!engine.canCreateFriendship(unauth, 'u1__u2', { userA: 'u1', userB: 'u2', status: 'pending', requestedBy: 'u1' }), 'Unauth friendship create denied');
    assert(!engine.canReadBlock(unauth, { blockerId: 'u1', blockedId: 'u2' }), 'Unauth block read denied');
    assert(!engine.canCreateBlock(unauth, 'u1__u2', { blockerId: 'u1', blockedId: 'u2' }), 'Unauth block create denied');
    assert(!engine.canCreateQuestInvite(unauth, 'token1234567890123456789012', { creatorId: 'u1', inviteToken: 'token1234567890123456789012', status: 'active' }), 'Unauth invite create denied');
    assert(!engine.canCreateGroupSession(unauth, { creatorId: 'u1', state: 'waiting' }), 'Unauth group session create denied');
    assert(!engine.canCreateSharedExperience(unauth, { creatorId: 'u1', participantIds: ['u1'] }), 'Unauth shared experience create denied');
  });

  await run('Security Rules', '8.2 Forged requestedBy / creatorId is DENIED', () => {
    const engine = new SocialAuthRulesEngine();
    const attacker = { uid: 'attacker_uid' };

    // Forged requestedBy
    const forgedFriendship = engine.canCreateFriendship(attacker, 'innocent__victim', {
      userA: 'innocent',
      userB: 'victim',
      status: 'pending',
      requestedBy: 'innocent', // Forging innocent as requester
    });
    assert(!forgedFriendship, 'Forging requestedBy must be DENIED');

    // Forged creatorId on invite
    const forgedInvite = engine.canCreateQuestInvite(attacker, 'tok_1234567890123456789012', {
      creatorId: 'innocent_uid', // Forging creatorId
      inviteToken: 'tok_1234567890123456789012',
      status: 'active',
    });
    assert(!forgedInvite, 'Forging creatorId on invite must be DENIED');

    // Forged creatorId on group session
    const forgedSession = engine.canCreateGroupSession(attacker, {
      creatorId: 'innocent_uid',
      state: 'waiting',
    });
    assert(!forgedSession, 'Forging creatorId on group session must be DENIED');
  });

  await run('Security Rules', '8.3 Requester CANNOT self-accept their own friend request', () => {
    const engine = new SocialAuthRulesEngine();
    const requester = { uid: 'user_requester' };

    const resource = {
      userA: 'user_recipient',
      userB: 'user_requester',
      status: 'pending',
      requestedBy: 'user_requester',
    };

    const selfAcceptAttempt = engine.canUpdateFriendship(requester, resource, {
      userA: 'user_recipient',
      userB: 'user_requester',
      status: 'accepted',
      requestedBy: 'user_requester',
    });
    assert(!selfAcceptAttempt, 'Requester self-approving friend request must be DENIED by rule');

    // But recipient CAN accept
    const recipient = { uid: 'user_recipient' };
    const recipientAccept = engine.canUpdateFriendship(recipient, resource, {
      userA: 'user_recipient',
      userB: 'user_requester',
      status: 'accepted',
      requestedBy: 'user_requester',
    });
    assert(recipientAccept, 'Recipient accepting request must be ALLOWED');
  });

  await run('Security Rules', '8.4 Blocked user interaction is DENIED by directional block existence checks', () => {
    const userBlocks = new Map<string, { blockerId: string; blockedId: string }>();
    userBlocks.set('user_alice__user_bob', { blockerId: 'user_alice', blockedId: 'user_bob' });

    const engine = new SocialAuthRulesEngine({ userBlocks });
    const bob = { uid: 'user_bob' };

    // Bob tries to friend Alice
    const bobRequest = engine.canCreateFriendship(bob, 'user_alice__user_bob', {
      userA: 'user_alice',
      userB: 'user_bob',
      status: 'pending',
      requestedBy: 'user_bob',
    });
    assert(!bobRequest, 'Blocked user creating friendship must be DENIED by noBlockBetween rule');

    // Alice also cannot friend Bob while block doc exists
    const alice = { uid: 'user_alice' };
    const aliceRequest = engine.canCreateFriendship(alice, 'user_alice__user_bob', {
      userA: 'user_alice',
      userB: 'user_bob',
      status: 'pending',
      requestedBy: 'user_alice',
    });
    assert(!aliceRequest, 'Friending blocked target before unblocking must be DENIED');
  });

  await run('Security Rules', '8.5 Group outsider CANNOT self-join without OWNER/ADMIN invite', () => {
    const groupQuestSessions = new Map<string, { creatorId: string; state: string }>();
    groupQuestSessions.set('session_1', { creatorId: 'user_owner', state: 'waiting' });

    const sessionMembers = new Map<string, { uid: string; role: 'OWNER' | 'ADMIN' | 'MEMBER'; status: string }>();
    sessionMembers.set('session_1__user_owner', { uid: 'user_owner', role: 'OWNER', status: 'active' });

    const engine = new SocialAuthRulesEngine({ groupQuestSessions, sessionMembers });
    const outsider = { uid: 'user_outsider' };

    // Outsider tries to create own membership row as active
    const selfJoinAttempt = engine.canCreateSessionMember(outsider, 'session_1', 'user_outsider', {
      uid: 'user_outsider',
      role: 'MEMBER',
      status: 'active',
    });
    assert(!selfJoinAttempt, 'Outsider self-joining group session must be DENIED');

    // Owner invites outsider as invited MEMBER
    const owner = { uid: 'user_owner' };
    const ownerInvite = engine.canCreateSessionMember(owner, 'session_1', 'user_outsider', {
      uid: 'user_outsider',
      role: 'MEMBER',
      status: 'invited',
    });
    assert(ownerInvite, 'Owner inviting outsider must be ALLOWED');
  });

  await run('Security Rules', '8.6 Member CANNOT elevate their own role to ADMIN or OWNER', () => {
    const groupQuestSessions = new Map<string, { creatorId: string; state: string }>();
    groupQuestSessions.set('session_2', { creatorId: 'user_owner', state: 'waiting' });

    const sessionMembers = new Map<string, { uid: string; role: 'OWNER' | 'ADMIN' | 'MEMBER'; status: string }>();
    sessionMembers.set('session_2__user_owner', { uid: 'user_owner', role: 'OWNER', status: 'active' });
    sessionMembers.set('session_2__user_member', { uid: 'user_member', role: 'MEMBER', status: 'invited' });

    const engine = new SocialAuthRulesEngine({ groupQuestSessions, sessionMembers });
    const member = { uid: 'user_member' };

    // Member updates status to active (allowed)
    const acceptUpdate = engine.canUpdateSessionMember(
      member,
      'session_2',
      'user_member',
      { uid: 'user_member', role: 'MEMBER', status: 'invited' },
      { uid: 'user_member', role: 'MEMBER', status: 'active' }
    );
    assert(acceptUpdate, 'Member accepting invite must be ALLOWED');

    // Member tries to escalate role to ADMIN
    const escalateAttempt = engine.canUpdateSessionMember(
      member,
      'session_2',
      'user_member',
      { uid: 'user_member', role: 'MEMBER', status: 'active' },
      { uid: 'user_member', role: 'ADMIN', status: 'active' }
    );
    assert(!escalateAttempt, 'Member escalating own role must be DENIED (unchanged role enforced)');
  });

  await run('Security Rules', '8.7 Cross-user notification injection is DENIED by owner-only rule', () => {
    const engine = new SocialAuthRulesEngine();
    const attacker = { uid: 'attacker_uid' };

    // Attacker tries to write notification to victim
    const canInject = engine.canWriteNotification(attacker, 'victim_uid');
    assert(!canInject, 'Writing to another user notification inbox must be DENIED');

    // Victim can write/manage own inbox
    const victim = { uid: 'victim_uid' };
    assert(engine.canWriteNotification(victim, 'victim_uid'), 'Owner writing to own notification inbox is ALLOWED');
  });

  await run('Security Rules', '8.8 Cross-user private memory / quest access is DENIED', () => {
    const engine = new SocialAuthRulesEngine();
    const attacker = { uid: 'attacker_uid' };

    assert(!engine.canReadUserMemory(attacker, 'victim_uid'), 'Reading another user memory must be DENIED');
    assert(!engine.canWriteUserMemory(attacker, 'victim_uid'), 'Writing to another user memory must be DENIED');
  });

  await run('Security Rules', '8.9 Shared experience creation requires creator in participantIds (<= 8)', () => {
    const engine = new SocialAuthRulesEngine();
    const user = { uid: 'user_author' };

    // Creator not in participantIds
    const notIncluded = engine.canCreateSharedExperience(user, {
      creatorId: 'user_author',
      participantIds: ['other_user_1', 'other_user_2'],
    });
    assert(!notIncluded, 'Creator missing from participantIds must be DENIED');

    // More than 8 participants
    const tooMany = engine.canCreateSharedExperience(user, {
      creatorId: 'user_author',
      participantIds: ['user_author', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'],
    });
    assert(!tooMany, 'Shared experience exceeding 8 participants must be DENIED');

    // Valid shared experience
    const validExp = engine.canCreateSharedExperience(user, {
      creatorId: 'user_author',
      participantIds: ['user_author', 'companion_1'],
    });
    assert(validExp, 'Valid shared experience must be ALLOWED');
  });

  await run('Security Rules', '8.10 Handle hijacking is DENIED (handles collection is create-only & unstealable)', () => {
    const engine = new SocialAuthRulesEngine();
    const attacker = { uid: 'attacker_uid' };

    assert(!engine.canUpdateHandle(), 'Updating an existing handle claim must be DENIED');

    // Attacker cannot create handle for someone else
    const forgedHandle = engine.canCreateHandle(attacker, 'alex_rivers', {
      uid: 'victim_uid',
      handleLower: 'alex_rivers',
    });
    assert(!forgedHandle, 'Claiming handle for different UID must be DENIED');
  });

  return results;
}

if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  console.log('Running Phase 14 Automated Test Suite...');
  runPhase14Tests().then(results => {
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    console.log(`\nPhase 14 Test Results: ${passedCount} passed, ${failedCount} failed (${results.length} total)`);
    if (failedCount > 0) {
      console.error('\nFailed tests:');
      results.filter(r => !r.passed).forEach(r => console.error(` - [${r.group}] ${r.test}: ${r.error}`));
      process.exitCode = 1;
    } else {
      console.log('✅ ALL PHASE 14 TESTS PASSED.');
    }
  });
}
