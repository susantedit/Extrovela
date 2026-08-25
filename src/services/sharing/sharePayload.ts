/**
 * EXTROVELA — Share Payload Construction (Phase 12) — PURE, no Firebase, no network.
 *
 * Everything about what a share link EXPOSES is decided here, so it can be unit
 * tested without a network and reviewed in one place. The single most important
 * function is assertNoDenylistedKeys: the public /shareLinks document must never
 * contain an internal identifier, and this proves it before the write leaves the
 * device (the Firestore rule enforces the same denylist as a second gate).
 */

import { PublicSharePayload, ShareTemplate, ShareTheme, ShareableSubject, ShareSubjectType } from '../../types/share';

/** Must stay identical to the denylist in firestore.rules for /shareLinks. */
export const SHARE_DENYLIST_KEYS = ['userId', 'uid', 'memoryId', 'recapId', 'storagePath', 'email', 'handle'] as const;

export const SHARE_TEMPLATES: ShareTemplate[] = ['minimal', 'editorial', 'photo', 'journal', 'recap'];

export interface ShareTemplateMeta {
  key: ShareTemplate;
  label: string;
  theme: ShareTheme;
  usesPhoto: boolean;
  description: string;
}

export const SHARE_TEMPLATE_META: Record<ShareTemplate, ShareTemplateMeta> = {
  minimal: { key: 'minimal', label: 'Minimal', theme: 'dark', usesPhoto: false, description: 'Title and one line, lots of space.' },
  editorial: { key: 'editorial', label: 'Editorial', theme: 'cream', usesPhoto: false, description: 'Serif headline over a light card.' },
  photo: { key: 'photo', label: 'Photo', theme: 'dark', usesPhoto: true, description: 'Your approved photo with a caption.' },
  journal: { key: 'journal', label: 'Journal', theme: 'gold', usesPhoto: false, description: 'An approved excerpt, journal style.' },
  recap: { key: 'recap', label: 'Recap', theme: 'lime', usesPhoto: false, description: 'A stat grid for a period recap.' },
};

const WEB_ORIGIN = 'https://extrovela.app';
const DEEP_LINK_SCHEME = 'extrovela://share/';

export function buildShareUrls(token: string): { deepLink: string; webUrl: string } {
  return { deepLink: `${DEEP_LINK_SCHEME}${token}`, webUrl: `${WEB_ORIGIN}/s/${token}` };
}

const MAX_STAT_LINES = 6;
const MAX_STAT_LINE_CHARS = 48;
const MAX_TITLE_CHARS = 120;
const MAX_QUOTE_CHARS = 180;

export function sanitizeStatLines(lines: string[] | undefined): string[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter(l => typeof l === 'string' && l.trim().length > 0)
    .slice(0, MAX_STAT_LINES)
    .map(l => l.trim().slice(0, MAX_STAT_LINE_CHARS));
}

function clip(value: string | undefined, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.trim();
  return t ? t.slice(0, max) : undefined;
}

export interface BuildPayloadOptions {
  token: string;
  ownerUid: string;
  imageUrl?: string;
  expiresAtIso?: string;
  version?: number;
  createdAtIso: string; // passed in — this module stays free of implicit clocks
}

/**
 * Builds the PUBLIC payload from an already-approved subject. Only whitelisted,
 * user-visible fields are copied; nothing is read from a Memory/Recap object
 * beyond what the caller placed on the ShareableSubject.
 */
export function buildPublicSharePayload(
  subject: ShareableSubject,
  template: ShareTemplate,
  opts: BuildPayloadOptions
): PublicSharePayload {
  const meta = SHARE_TEMPLATE_META[template] || SHARE_TEMPLATE_META.minimal;
  const { deepLink, webUrl } = buildShareUrls(opts.token);
  const title = clip(subject.title, MAX_TITLE_CHARS) || 'An EXTROVELA experience';
  const statLines = sanitizeStatLines(subject.statLines);

  const ogDescriptionParts = [subject.subtitle, statLines.join(' · ')].filter(Boolean) as string[];

  const payload: PublicSharePayload = {
    ownerUid: opts.ownerUid,
    template,
    subjectType: subject.type,
    theme: meta.theme,
    title,
    subtitle: clip(subject.subtitle, MAX_TITLE_CHARS),
    statLines,
    quote: clip(subject.quote, MAX_QUOTE_CHARS),
    placeLabel: clip(subject.placeLabel, 60),
    dateLabel: clip(subject.dateLabel, 40),
    imageUrl: opts.imageUrl, // the rendered card URL, attached for every template
    ogTitle: title,
    ogDescription: (ogDescriptionParts.join(' — ') || 'A real-world experience worth remembering.').slice(0, 200),
    ogImageUrl: opts.imageUrl,
    deepLink,
    webUrl,
    version: opts.version ?? 1,
    revoked: false,
    createdAt: opts.createdAtIso,
    ...(opts.expiresAtIso ? { expiresAt: opts.expiresAtIso } : {}),
  };

  // Prove the invariant before anyone can persist it.
  assertNoDenylistedKeys(payload);
  return payload;
}

/**
 * Throws if `obj` (recursively) contains any denylisted key. This is the client's
 * own guarantee that a public share document leaks no internal identifier; the
 * Firestore rule rejects the same keys independently.
 */
export function assertNoDenylistedKeys(obj: unknown, path = 'payload'): void {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => assertNoDenylistedKeys(item, `${path}[${i}]`));
    return;
  }
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if ((SHARE_DENYLIST_KEYS as readonly string[]).includes(key)) {
      throw new Error(`Refusing to publish share payload: denylisted key "${key}" at ${path}.${key}`);
    }
    assertNoDenylistedKeys((obj as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

/** True when a public link should still resolve, given the caller's current time. */
export function isShareLinkLive(payload: Pick<PublicSharePayload, 'revoked' | 'expiresAt'>, nowMs: number): boolean {
  if (payload.revoked === true) return false;
  if (payload.expiresAt) {
    const exp = new Date(payload.expiresAt).getTime();
    if (Number.isFinite(exp) && nowMs >= exp) return false;
  }
  return true;
}

/** Convenience for callers building a subject from a recap. Not persisted directly. */
export function recapSubjectType(): ShareSubjectType {
  return 'recap';
}
