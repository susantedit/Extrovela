/**
 * EXTROVELA — Shareable Experience Card Contracts (Phase 12)
 *
 * A share link is PUBLIC and cannot be un-published once crawled. Two rules keep
 * it safe, and both are the writing client's responsibility (see
 * ShareExperienceCardService and the Firestore rule on /shareLinks/{token}):
 *
 *   1. The token is high-entropy random. It is not the userId, not a Firestore
 *      document id, not a storage path.
 *   2. The PUBLIC payload contains ONLY fields the user approved in the preview,
 *      and provably none of: userId, uid, memoryId, recapId, storagePath, email,
 *      handle. That denylist is enforced by the rule AND re-checked client-side
 *      before the write (assertNoDenylistedKeys).
 */

export type ShareTemplate = 'minimal' | 'editorial' | 'photo' | 'journal' | 'recap';

export type ShareSubjectType = 'memory' | 'recap';

export type ShareTheme = 'lime' | 'gold' | 'cream' | 'dark';

/**
 * The user-approved, already-sanitized content that a card is composed from.
 * Coordinates and raw private reflections are never placed here — only a
 * city/neighbourhood label and an explicitly-approved excerpt.
 */
export interface ShareableSubject {
  type: ShareSubjectType;
  title: string;
  subtitle?: string;
  statLines?: string[]; // e.g. ["12 experiences", "4 new places"]
  quote?: string; // user-approved excerpt only; never the full private reflection
  placeLabel?: string; // city / neighbourhood, never coordinates
  dateLabel?: string;
  accentPhotoUrl?: string; // only for the photo template, user-approved
}

/**
 * The EXACT shape written to the public /shareLinks/{token} document.
 * By construction it carries no internal identifier. `ownerUid` is required by
 * the rule and is intentionally NOT on the denylist (the denylist rejects `uid`,
 * a different key). It lets the owner revoke; it is not the userId's memory/recap.
 */
export interface PublicSharePayload {
  ownerUid: string;
  template: ShareTemplate;
  subjectType: ShareSubjectType;
  theme: ShareTheme;

  title: string;
  subtitle?: string;
  statLines: string[];
  quote?: string;
  placeLabel?: string;
  dateLabel?: string;

  imageUrl?: string; // download URL of the rendered card — a URL, never a storage path
  ogTitle: string;
  ogDescription: string;
  ogImageUrl?: string;

  deepLink: string; // extrovela://share/{token}
  webUrl: string; // https://extrovela.app/s/{token}

  version: number;
  revoked: boolean;
  createdAt: string;
  expiresAt?: string; // ISO in the type; written as a Firestore Timestamp
}

/**
 * The owner-only index at users/{userId}/shareTokens/{tokenId}. Because only the
 * owner can read it, it MAY carry the internal linkage needed to revoke and to
 * delete the rendered image later.
 */
export interface ShareTokenIndex {
  id: string;
  userId: string;
  token: string; // >= 22 chars (Firestore rule)
  subjectType: ShareSubjectType;
  subjectId: string; // memoryId or recapId — safe here, this doc is owner-only
  template: ShareTemplate;
  imageStoragePath?: string;
  webUrl: string;
  createdAt: string;
  expiresAt?: string;
  revoked: boolean;
}
