/**
 * EXTROVELA — Shareable Experience Card Service (Phase 12)
 *
 * Turns a memory or a recap into a public, link-shareable card. A share link is
 * irreversible once crawled, so this service is built defensively:
 *
 *   - Token: cryptographically random, >= 28 base62 chars (tokenGenerator.ts).
 *     Never the userId, a Firestore id, or a storage path.
 *   - Preview: `preview()` returns EXACTLY the public payload the user is about to
 *     publish, so the share sheet can show "here is everything that becomes
 *     public" before anything leaves the device. Publishing is never automatic.
 *   - Payload safety: the public document is built by buildPublicSharePayload,
 *     which self-asserts that no internal identifier (userId/uid/memoryId/
 *     recapId/storagePath/email/handle) is present. The Firestore rule enforces
 *     the same denylist independently.
 *   - Image: the card is a NEWLY rendered composite, never the user's original
 *     private media. It is uploaded to the publicly-readable shareCards/ tree,
 *     whose URL (not path) goes into the payload.
 *   - Expiry & revocation: expiry is stored so a lapsed link stops resolving;
 *     revoke() flips the public doc, the owner index, and deletes the image.
 */

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseApp } from '../firebase/firebaseConfig';
import { firestoreService } from '../firebase/firestore';
import { mediaStorageService } from '../media/mediaStorageService';
import {
  buildPublicSharePayload,
  buildShareUrls,
  isShareLinkLive,
  SHARE_TEMPLATE_META,
} from './sharePayload';
import { generateSecureToken } from '../security/tokenGenerator';
import {
  ShareableSubject,
  ShareTemplate,
  ShareSubjectType,
  PublicSharePayload,
  ShareTokenIndex,
} from '../../types/share';

const THEME_COLORS: Record<string, { bg: string; fg: string; accent: string }> = {
  dark: { bg: '#08090D', fg: '#F6F1E7', accent: '#84CC16' },
  lime: { bg: '#0B0F08', fg: '#F6F1E7', accent: '#84CC16' },
  gold: { bg: '#121008', fg: '#F6F1E7', accent: '#C99A45' },
  cream: { bg: '#F6F1E7', fg: '#20211B', accent: '#C99A45' },
};

export interface PublishParams {
  userId: string; // authenticated uid (owner)
  subject: ShareableSubject;
  template: ShareTemplate;
  subjectType: ShareSubjectType;
  subjectId: string; // memoryId or recapId — kept only in the OWNER index
  expiresInDays?: number;
}

export interface PublishResult {
  token: string;
  webUrl: string;
  deepLink: string;
  imageUrl?: string;
  payload: PublicSharePayload;
}

export class ShareExperienceCardService {
  /**
   * Exactly what will be published, without publishing. The token here is a
   * placeholder so the UI can render the card; the real token is minted in
   * publish(). Nothing is written to Firestore or Storage.
   */
  preview(subject: ShareableSubject, template: ShareTemplate): PublicSharePayload {
    return buildPublicSharePayload(subject, template, {
      token: 'PREVIEW0PREVIEW0PREVIEW0', // 24 chars, satisfies the length floor for preview only
      ownerUid: 'preview',
      createdAtIso: new Date().toISOString(),
    });
  }

  /** Publishes a card: mints a token, renders + uploads the image, writes both docs. */
  async publish(params: PublishParams, cardBlob?: Blob): Promise<PublishResult> {
    const token = generateSecureToken();
    const { webUrl, deepLink } = buildShareUrls(token);
    const nowIso = new Date().toISOString();
    const expiresAtIso = params.expiresInDays && params.expiresInDays > 0
      ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    // Render + upload the card image (public tree). Text-only card if unavailable.
    let imageUrl: string | undefined;
    let imageStoragePath: string | undefined;
    const blob = cardBlob || (await this.renderCardToBlob(this.preview(params.subject, params.template), params.template));
    const app = getFirebaseApp();
    if (blob && app) {
      try {
        imageStoragePath = `shareCards/${params.userId}/${token}/card.jpg`;
        const storageRef = ref(getStorage(app), imageStoragePath);
        await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
        imageUrl = await getDownloadURL(storageRef);
      } catch {
        imageUrl = undefined;
        imageStoragePath = undefined;
      }
    }

    // Build the PUBLIC payload (self-asserts the denylist), then persist.
    const payload = buildPublicSharePayload(params.subject, params.template, {
      token,
      ownerUid: params.userId,
      imageUrl,
      expiresAtIso,
      createdAtIso: nowIso,
    });

    // Owner-only index first (so a revoke is always possible even if the next
    // write is interrupted), then the public link.
    const ownerIndex: ShareTokenIndex = {
      id: token,
      userId: params.userId,
      token,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      template: params.template,
      imageStoragePath,
      webUrl,
      createdAt: nowIso,
      expiresAt: expiresAtIso,
      revoked: false,
    };
    await firestoreService.saveShareToken(params.userId, ownerIndex);
    await firestoreService.savePublicShareLink(token, payload);

    return { token, webUrl, deepLink, imageUrl, payload };
  }

  /** Revokes a share: flips the public doc, flips the owner index, deletes the image. */
  async revoke(userId: string, token: string): Promise<void> {
    const owned = await firestoreService.getShareTokens(userId).catch(() => [] as ShareTokenIndex[]);
    const entry = owned.find(t => t.token === token || t.id === token);

    await firestoreService.revokePublicShareLink(token).catch(() => {});
    await firestoreService.revokeShareToken(userId, entry?.id || token).catch(() => {});
    if (entry?.imageStoragePath) {
      await mediaStorageService.deleteMediaItem(entry.imageStoragePath).catch(() => {});
    }
  }

  /** The owner's list of issued links (for a "Manage shares" screen). */
  async listOwn(userId: string): Promise<ShareTokenIndex[]> {
    return firestoreService.getShareTokens(userId);
  }

  /**
   * Resolves a public token to its payload, honouring revocation and expiry.
   * Returns null for a revoked, expired, or unknown token.
   */
  async resolve(token: string): Promise<PublicSharePayload | null> {
    const payload = await firestoreService.getPublicShareLink(token);
    if (!payload) return null;
    return isShareLinkLive(payload, Date.now()) ? payload : null;
  }

  /**
   * Renders a 9:16 card to a JPEG blob using canvas. Returns null when there is no
   * DOM canvas (e.g. a background/worker context) — callers then publish a
   * text-only card and the web page renders the payload directly.
   */
  async renderCardToBlob(payload: PublicSharePayload, template: ShareTemplate): Promise<Blob | null> {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    const W = 1080;
    const H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const meta = SHARE_TEMPLATE_META[template] || SHARE_TEMPLATE_META.minimal;
    const colors = THEME_COLORS[meta.theme] || THEME_COLORS.dark;

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);

    // Accent rule
    ctx.fillStyle = colors.accent;
    ctx.fillRect(96, 300, 120, 8);

    // Title (wrapped)
    ctx.fillStyle = colors.fg;
    ctx.font = '700 84px Georgia, serif';
    let y = 420;
    y = this.wrapText(ctx, payload.title, 96, y, W - 192, 96);

    // Subtitle
    if (payload.subtitle) {
      ctx.font = '400 40px Georgia, serif';
      ctx.fillStyle = colors.accent;
      y = this.wrapText(ctx, payload.subtitle, 96, y + 40, W - 192, 52);
    }

    // Stat lines
    ctx.fillStyle = colors.fg;
    ctx.font = '400 44px Arial, sans-serif';
    y += 60;
    for (const line of payload.statLines.slice(0, 6)) {
      ctx.fillText(`•  ${line}`, 96, y);
      y += 64;
    }

    // Quote
    if (payload.quote) {
      ctx.font = 'italic 400 40px Georgia, serif';
      ctx.fillStyle = colors.accent;
      this.wrapText(ctx, `"${payload.quote}"`, 96, y + 40, W - 192, 54);
    }

    // Footer
    ctx.fillStyle = colors.fg;
    ctx.globalAlpha = 0.7;
    ctx.font = '600 34px Arial, sans-serif';
    ctx.fillText('EXTROVELA', 96, H - 120);
    if (payload.placeLabel) {
      ctx.globalAlpha = 0.5;
      ctx.font = '400 30px Arial, sans-serif';
      ctx.fillText(payload.placeLabel, 96, H - 76);
    }
    ctx.globalAlpha = 1;

    return new Promise<Blob | null>(resolve => {
      canvas.toBlob(b => resolve(b), 'image/jpeg', 0.9);
    });
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
    const words = text.split(/\s+/);
    let line = '';
    let cursorY = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cursorY);
        line = word;
        cursorY += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, cursorY);
      cursorY += lineHeight;
    }
    return cursorY;
  }
}

export const shareExperienceCardService = new ShareExperienceCardService();
export default shareExperienceCardService;
