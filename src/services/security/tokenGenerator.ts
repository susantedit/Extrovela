/**
 * EXTROVELA — Secure Share Token Generator (Phase 12)
 *
 * Share links are public and unguessable-by-design. The token is the ONLY thing
 * standing between "anyone with the link can see the card" and "anyone can
 * enumerate everyone's cards", so it must come from a cryptographically secure
 * RNG — never Math.random.
 *
 * Pure and dependency-free: the RNG is injectable so it can be tested
 * deterministically, and defaults to the platform CSPRNG (Web Crypto, present in
 * browsers and modern Node).
 */

// Unreserved URL-safe alphabet. 62 symbols → ~5.95 bits each.
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// The Firestore rule requires >= 22 chars. 28 base62 chars ≈ 166 bits of entropy,
// comfortably above the floor and far beyond brute-force reach.
export const SHARE_TOKEN_LENGTH = 28;
export const MIN_SHARE_TOKEN_LENGTH = 22;

/** Fills `out` with cryptographically secure bytes, or throws if none is available. */
export type SecureRng = (out: Uint8Array) => void;

function platformRng(out: Uint8Array): void {
  const c: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (!c || typeof c.getRandomValues !== 'function') {
    // We deliberately do NOT silently fall back to Math.random: a share token is a
    // capability, and a predictable one is a vulnerability, not a convenience.
    throw new Error('No cryptographically secure RNG available for share tokens');
  }
  c.getRandomValues(out);
}

/**
 * Generates a base62 token of `length` chars using rejection sampling to avoid
 * modulo bias (256 is not a multiple of 62, so a naive `byte % 62` would favour
 * the first 8 symbols). Bytes >= 248 are discarded and redrawn.
 */
export function generateSecureToken(length: number = SHARE_TOKEN_LENGTH, rng: SecureRng = platformRng): string {
  if (length < MIN_SHARE_TOKEN_LENGTH) {
    throw new Error(`Share token length must be >= ${MIN_SHARE_TOKEN_LENGTH}`);
  }
  const out: string[] = [];
  const buf = new Uint8Array(length);
  // The unbiased ceiling: largest multiple of 62 that fits in a byte.
  const ceiling = 256 - (256 % 62); // = 248
  while (out.length < length) {
    rng(buf);
    for (let i = 0; i < buf.length && out.length < length; i += 1) {
      const b = buf[i];
      if (b < ceiling) out.push(BASE62[b % 62]);
    }
  }
  return out.join('');
}

/** A token is valid iff it meets the length floor and is base62 (URL-safe). */
export function isValidShareToken(token: unknown): token is string {
  return typeof token === 'string' && token.length >= MIN_SHARE_TOKEN_LENGTH && /^[0-9A-Za-z]+$/.test(token);
}
