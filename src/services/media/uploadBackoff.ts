/**
 * EXTROVELA — Upload Retry Backoff (Phase 12) — PURE, no Firebase, no network.
 *
 * A fixed, deterministic backoff schedule for resumable media uploads. Kept pure
 * and clock-free so it can be tested directly and so the retry budget is a
 * property of the code, not of wall-clock timing.
 */

export const MAX_UPLOAD_RETRIES = 5;

// Fixed exponential-ish schedule in milliseconds, one entry per attempt.
const SCHEDULE_MS = [1000, 2000, 4000, 8000, 16000];

/** Delay before the retry that FOLLOWS `attempt` (0-based). */
export function nextRetryDelayMs(attempt: number): number {
  if (attempt < 0) return SCHEDULE_MS[0];
  return SCHEDULE_MS[Math.min(attempt, SCHEDULE_MS.length - 1)];
}

/** Whether another retry is permitted after `attempt` failures. */
export function isRetriable(attempt: number): boolean {
  return attempt < MAX_UPLOAD_RETRIES;
}

/** 0..1 progress from bytes, guarded against a zero/again-unknown total. */
export function progressFraction(bytesTransferred: number, totalBytes: number): number {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return 0;
  const f = bytesTransferred / totalBytes;
  if (f < 0) return 0;
  if (f > 1) return 1;
  return Number(f.toFixed(4));
}
