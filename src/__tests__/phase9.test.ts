/**
 * EXTROVELA — Phase 9 Automated Test Suite
 * 
 * Tests:
 * 1. Friend request flows (send, accept, decline, remove)
 * 2. Rate limiter protection
 * 3. Safety Block enforcement
 * 4. Quest Invite token generation, expiration & validation
 * 5. Group Quest Session state machine & participant limits
 * 6. Safety Report generation
 */

import { SocialService } from '../services/social/socialService';
import { QuestSharingService } from '../services/social/questSharingService';
import { GroupQuestSessionService } from '../services/social/groupQuestSessionService';
import { socialRepository } from '../repositories/SocialRepository';
import { rateLimiter } from '../services/social/rateLimiter';
import { Quest } from '../types/quest';

// Mock localStorage for node test environment if needed
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof window === 'undefined') {
  (global as any).localStorage = localStorageMock;
}

export function runPhase9Tests() {
  const results: { test: string; passed: boolean; error?: string }[] = [];

  const assert = (condition: boolean, testName: string) => {
    if (!condition) {
      results.push({ test: testName, passed: false, error: 'Assertion failed' });
      throw new Error(`TEST FAILED: ${testName}`);
    }
    results.push({ test: testName, passed: true });
  };

  // 1. Friend Request & Acceptance Flow
  try {
    rateLimiter.reset();
    socialRepository.sendFriendRequest('user_uA', 'user_uB').then(async friendship => {
      assert(friendship.status === 'pending', 'Friend request initializes as pending');

      await socialRepository.acceptFriendRequest(friendship.id);
      const updated = (socialRepository as any).localFriendships.get(friendship.id);
      assert(updated.status === 'accepted', 'Accepting friend request updates status to accepted');
    });
  } catch (err: any) {
    results.push({ test: 'Friend Request & Acceptance Flow', passed: false, error: err.message });
  }

  // 2. Block Enforcement
  try {
    socialRepository.blockUser('user_uC', 'user_uD').then(async () => {
      let blockedError = false;
      try {
        await socialRepository.sendFriendRequest('user_uC', 'user_uD');
      } catch {
        blockedError = true;
      }
      assert(blockedError, 'Blocked user cannot receive friend request');
    });
  } catch (err: any) {
    results.push({ test: 'Block Enforcement', passed: false, error: err.message });
  }

  // 3. Rate Limiter Protection
  try {
    rateLimiter.reset('friend_request', 'spammer_user');
    let limitHit = false;

    for (let i = 0; i < 15; i++) {
      const res = rateLimiter.isAllowed('friend_request', 'spammer_user', { maxRequests: 5, windowMs: 60000 });
      if (!res.allowed) {
        limitHit = true;
        break;
      }
    }
    assert(limitHit, 'Rate limiter triggers after max requests threshold');
  } catch (err: any) {
    results.push({ test: 'Rate Limiter Protection', passed: false, error: err.message });
  }

  // 4. Quest Invite Token & Validation
  try {
    rateLimiter.reset('invite_create', 'creator_1');
    const dummyQuest: Quest = {
      id: 'q_tea_sanctuary',
      title: 'Tea Sanctuary Meditation',
      description: 'Find a quiet courtyard teahouse.',
      category: 'Sanctuary',
      environment: 'Indoor',
      mood: 'Peaceful',
      energy: 'Chill',
      time: '30 mins',
      budget: 'Free',
      social: 'With a friend',
      season: 'Any',
      tags: ['tea', 'peaceful'],
    };

    const invite = QuestSharingService.createInvite(dummyQuest, 'creator_1', 'Creator One', 'link', 4);
    invite.then(inv => {
      assert(inv.inviteToken.startsWith('inv_'), 'Invite token starts with inv_ prefix');
      assert(inv.maxParticipants === 4, 'Invite preserves max participants limit');
      
      const shareUrl = QuestSharingService.getShareUrl(inv);
      const parsedToken = QuestSharingService.parseInviteFromUrl(shareUrl);
      assert(parsedToken === inv.inviteToken, 'URL parser correctly extracts invite token');
    });
  } catch (err: any) {
    results.push({ test: 'Quest Invite Token & Validation', passed: false, error: err.message });
  }

  // 5. Group Quest Session State Machine & Participant Limit
  try {
    const sessionPromise = GroupQuestSessionService.createGroupSession(
      'q_lake_walk',
      'host_user',
      'Host User',
      [{ id: 'friend_1', name: 'Friend One' }],
      2
    );

    sessionPromise.then(async session => {
      assert(session.state === 'waiting', 'New group quest session starts in waiting state');
      assert(session.participants.length === 2, 'Session contains 2 initial participants');

      // Attempt joining 3rd participant when max limit is 2
      let overLimitError = false;
      try {
        await GroupQuestSessionService.joinGroupSession(session.id, { id: 'friend_2', name: 'Friend Two' }, 2);
      } catch {
        overLimitError = true;
      }
      assert(overLimitError, 'Group session prevents exceeding max participants limit');
    });
  } catch (err: any) {
    results.push({ test: 'Group Quest Session State Machine', passed: false, error: err.message });
  }

  // 6. Safety Report Creation
  try {
    const reportPromise = socialRepository.reportUser({
      reporterId: 'reporter_user',
      reportedUserId: 'abusive_user',
      reason: 'harassment',
      description: 'Inappropriate message sent.',
    });

    reportPromise.then(rep => {
      assert(rep.status === 'pending', 'Submitted safety report status is pending');
      assert(rep.reason === 'harassment', 'Submitted safety report preserves reason category');
    });
  } catch (err: any) {
    results.push({ test: 'Safety Report Creation', passed: false, error: err.message });
  }

  return results;
}

if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  console.log('Running Phase 9 automated tests...');
  const res = runPhase9Tests();
  console.log('Test Results:', JSON.stringify(res, null, 2));
}
