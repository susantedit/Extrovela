/**
 * EXTROVELA — Bounded Social Realtime (Phase 14)
 *
 * The ONLY realtime mechanism in the social layer: Firestore `onSnapshot`. No
 * Pusher/Ably/PubNub/socket server — this is free-tier by construction.
 *
 * Every subscription here obeys three rules that keep it cheap and leak-free:
 *   1. BOUNDED   — every query carries an explicit `limit()`, so a runaway
 *                  collection can never stream unbounded reads (and therefore
 *                  can never blow the Firestore free-tier read quota).
 *   2. SCOPED    — equality filters on the caller's own uid / session id only.
 *                  Firestore cannot OR across two fields, so "friendships where
 *                  I am either party" is two listeners merged client-side.
 *   3. DETACHABLE — each function returns a Firestore `Unsubscribe`; the
 *                  `useFirestoreSubscription` hook wires it into `useEffect`'s
 *                  cleanup so a listener never outlives the component.
 *
 * Local-first / test / placeholder-cred posture: `getDb()` is null, so every
 * subscription is a no-op that returns NOOP immediately. Nothing throws, no
 * listener is attached, and callers degrade to whatever one-shot data they hold.
 */

import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Firestore,
  type Unsubscribe,
  type QuerySnapshot,
} from 'firebase/firestore';
import { getFirebaseApp } from '../firebase/firebaseConfig';
import { Friendship, GroupMember, QuestInvite } from '../../types/social';
import { AppNotification } from '../../types/notification';
import logger from '../../utils/logger';

/** A no-op unsubscribe — returned whenever there is nothing to detach. */
export const NOOP_UNSUBSCRIBE: Unsubscribe = () => {};

/** Bounds chosen to sit comfortably under the Firestore free-tier read quota. */
const FRIENDS_LIMIT = 200;
const REQUESTS_LIMIT = 100;
const MEMBERS_LIMIT = 12;
const INVITES_LIMIT = 50;
const NOTIFICATIONS_LIMIT = 50;

function getDb(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getFirestore(app);
}

function mapDocs<T>(snap: QuerySnapshot): T[] {
  return snap.docs.map(d => d.data() as T);
}

/**
 * Accepted friendships in which I am a party. Two listeners (userA==me,
 * userB==me) because Firestore has no cross-field OR; results are merged by
 * doc id so a friendship never double-counts.
 */
export function subscribeAcceptedFriendships(
  userId: string,
  onChange: (friendships: Friendship[]) => void
): Unsubscribe {
  const db = getDb();
  if (!db || !userId) return NOOP_UNSUBSCRIBE;

  const col = collection(db, 'friendships');
  let sideA: Friendship[] = [];
  let sideB: Friendship[] = [];

  const emit = () => {
    const merged = new Map<string, Friendship>();
    for (const f of [...sideA, ...sideB]) merged.set(f.id, f);
    onChange([...merged.values()]);
  };

  const onErr = (label: string) => (err: Error) =>
    logger.warn('friendships listener error', { side: label, err: err.message });

  const unsubA = onSnapshot(
    query(col, where('userA', '==', userId), where('status', '==', 'accepted'), limit(FRIENDS_LIMIT)),
    snap => { sideA = mapDocs<Friendship>(snap); emit(); },
    onErr('A')
  );
  const unsubB = onSnapshot(
    query(col, where('userB', '==', userId), where('status', '==', 'accepted'), limit(FRIENDS_LIMIT)),
    snap => { sideB = mapDocs<Friendship>(snap); emit(); },
    onErr('B')
  );

  return () => { unsubA(); unsubB(); };
}

/**
 * Pending friend requests addressed to me: pending rows where I am a party but
 * NOT the requester. Two listeners (I may be userA or userB — ids are sorted),
 * merged, then client-filtered to `requestedBy != me`.
 */
export function subscribePendingFriendRequests(
  userId: string,
  onChange: (requests: Friendship[]) => void
): Unsubscribe {
  const db = getDb();
  if (!db || !userId) return NOOP_UNSUBSCRIBE;

  const col = collection(db, 'friendships');
  let sideA: Friendship[] = [];
  let sideB: Friendship[] = [];

  const emit = () => {
    const merged = new Map<string, Friendship>();
    for (const f of [...sideA, ...sideB]) {
      if (f.requestedBy !== userId) merged.set(f.id, f);
    }
    onChange([...merged.values()]);
  };

  const onErr = (label: string) => (err: Error) =>
    logger.warn('pending-requests listener error', { side: label, err: err.message });

  const unsubA = onSnapshot(
    query(col, where('userA', '==', userId), where('status', '==', 'pending'), limit(REQUESTS_LIMIT)),
    snap => { sideA = mapDocs<Friendship>(snap); emit(); },
    onErr('A')
  );
  const unsubB = onSnapshot(
    query(col, where('userB', '==', userId), where('status', '==', 'pending'), limit(REQUESTS_LIMIT)),
    snap => { sideB = mapDocs<Friendship>(snap); emit(); },
    onErr('B')
  );

  return () => { unsubA(); unsubB(); };
}

/**
 * Live roster of one group session's members. Single subcollection listener,
 * bounded to the small-group cap. Attach only while the session modal is open.
 */
export function subscribeSessionMembers(
  sessionId: string,
  onChange: (members: GroupMember[]) => void
): Unsubscribe {
  const db = getDb();
  if (!db || !sessionId) return NOOP_UNSUBSCRIBE;

  return onSnapshot(
    query(collection(db, 'groupQuestSessions', sessionId, 'members'), limit(MEMBERS_LIMIT)),
    snap => onChange(mapDocs<GroupMember>(snap)),
    err => logger.warn('session-members listener error', { sessionId, err: err.message })
  );
}

/**
 * Quest invites I created ("my invites" host view). Received invites are
 * token/deep-link based (no recipient field to query on), so they arrive via
 * the invite link — not through a standing listener.
 */
export function subscribeSentInvites(
  userId: string,
  onChange: (invites: QuestInvite[]) => void
): Unsubscribe {
  const db = getDb();
  if (!db || !userId) return NOOP_UNSUBSCRIBE;

  return onSnapshot(
    query(
      collection(db, 'questInvites'),
      where('creatorId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(INVITES_LIMIT)
    ),
    snap => onChange(mapDocs<QuestInvite>(snap)),
    err => logger.warn('sent-invites listener error', { err: err.message })
  );
}

/**
 * Unread items in my own notification inbox (owner-only tree). Queried by
 * `status in ['sent','delivered']` — NOT `readAt == null`, because Firestore
 * `== null` matches only explicit nulls and unread docs omit `readAt` entirely.
 */
export function subscribeUnreadNotifications(
  userId: string,
  onChange: (notifications: AppNotification[]) => void
): Unsubscribe {
  const db = getDb();
  if (!db || !userId) return NOOP_UNSUBSCRIBE;

  return onSnapshot(
    query(
      collection(db, 'users', userId, 'notifications'),
      where('status', 'in', ['sent', 'delivered']),
      orderBy('createdAt', 'desc'),
      limit(NOTIFICATIONS_LIMIT)
    ),
    snap => onChange(mapDocs<AppNotification>(snap)),
    err => logger.warn('notifications listener error', { err: err.message })
  );
}
