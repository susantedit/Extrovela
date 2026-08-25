/**
 * EXTROVELA — Derived Social Notifications (Phase 14)
 *
 * Social events surface in the EXISTING Phase-10 inbox as ordinary
 * `AppNotification`s. Critically, they are DERIVED (projected) from social state
 * the current user is already authorized to read — never written into another
 * user's notification tree. That constraint is not a nicety; it is forced by the
 * Security Rules: `users/{uid}/notifications` is owner-only, so an inviter
 * literally cannot write a notification into an invitee's inbox. The only
 * rules-legal way for "X invited you" to appear is for the invitee's own client
 * to derive it from the authorized friendship/session/experience row. Hence
 * these pure mappers + a fail-soft deriver, and zero cross-user writes.
 *
 * Because they are projections of live state, there is nothing to "mark read":
 * a derived friend-invite disappears the instant the underlying request is
 * accepted or declined. That is the intended lifecycle.
 */

import { AppNotification } from '../../types/notification';
import { Friendship, GroupMember, SharedExperience } from '../../types/social';
import { socialRepository } from '../../repositories/SocialRepository';
import logger from '../../utils/logger';

/**
 * A pending friendship addressed to me → a `friendInvite` notification.
 * `f` is expected to be a request where I am the non-requester (this is exactly
 * what `SocialRepository.getPendingRequests` returns), so `meUid` is the recipient.
 */
export function pendingRequestToNotification(
  f: Friendship,
  meUid: string,
  requesterName?: string
): AppNotification {
  const who = requesterName?.trim() || 'A fellow explorer';
  return {
    id: `social_friendInvite_${f.id}`,
    userId: meUid,
    type: 'friendInvite',
    title: 'New companion request',
    body: `${who} would like to explore together.`,
    priority: 'normal',
    deepLink: 'extrovela://friends/requests',
    status: 'delivered',
    dedupeKey: `friendInvite:${f.id}`,
    createdAt: f.createdAt,
  };
}

/**
 * An `invited` membership row that belongs to me → a `groupQuest` notification.
 *
 * NOTE: this mapper is intentionally NOT wired into `deriveSocialNotifications`.
 * Discovering "sessions I've been invited to" across the whole collection needs a
 * `members` collectionGroup query, which in turn needs a broadened collectionGroup
 * read rule — that belongs with the explicitly-deferred cross-device push work.
 * Today this mapper is used only where the client already holds the member row
 * (the open session modal), and is unit-tested as a pure function.
 */
export function invitedMembershipToNotification(
  sessionId: string,
  member: GroupMember
): AppNotification {
  return {
    id: `social_groupQuest_${sessionId}_${member.uid}`,
    userId: member.uid,
    type: 'groupQuest',
    title: 'You’re invited to a group quest',
    body: 'A companion invited you to explore together.',
    priority: 'normal',
    deepLink: `extrovela://group/${sessionId}`,
    status: 'delivered',
    dedupeKey: `groupQuest:${sessionId}:${member.uid}`,
    createdAt: member.joinedAt,
  };
}

/** A shared experience I took part in → a `sharedExperience` notification. */
export function sharedExperienceToNotification(
  exp: SharedExperience,
  meUid: string
): AppNotification {
  const others = exp.participantNames.filter((_, i) => exp.participantIds[i] !== meUid);
  const companions = others.length ? others.slice(0, 2).join(', ') : 'your companions';
  return {
    id: `social_sharedExperience_${exp.id}`,
    userId: meUid,
    type: 'sharedExperience',
    title: 'A shared memory is ready',
    body: `You completed “${exp.questTitle}” with ${companions}.`,
    priority: 'low',
    deepLink: `extrovela://shared/${exp.id}`,
    status: 'delivered',
    dedupeKey: `sharedExperience:${exp.id}`,
    createdAt: exp.completedAt,
  };
}

/**
 * Project the current user's authorized social state into inbox notifications.
 *
 * Fail-soft by design: a single failing source (e.g. fail-clean throw when a
 * production build has no Firebase configured) degrades that source to empty and
 * is logged — it must never take down the whole inbox. Reads are bounded and
 * indexed (see SocialRepository / firestore.indexes.json), so this stays within
 * the Firestore free-tier read budget.
 */
export async function deriveSocialNotifications(userId: string): Promise<AppNotification[]> {
  if (!userId) return [];
  const out: AppNotification[] = [];

  try {
    const pending = await socialRepository.getPendingRequests(userId);
    for (const f of pending) out.push(pendingRequestToNotification(f, userId));
  } catch (err) {
    logger.warn('Could not derive friend-request notifications', { err: (err as Error).message });
  }

  try {
    const shared = await socialRepository.getSharedExperiences(userId, 10);
    for (const exp of shared) out.push(sharedExperienceToNotification(exp, userId));
  } catch (err) {
    logger.warn('Could not derive shared-experience notifications', { err: (err as Error).message });
  }

  return out;
}
