/**
 * EXTROVELA — Social Rate Limiter & Anti-Spam Utility (Phase 9)
 * 
 * Protects social actions from mass account enumeration, request spamming,
 * invite link spamming, and report flooding.
 */

import logger from '../../utils/logger';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  friend_request: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  handle_search: { maxRequests: 20, windowMs: 60 * 1000 },       // 20 per minute
  invite_create: { maxRequests: 15, windowMs: 60 * 60 * 1000 },  // 15 per hour
  report_submit: { maxRequests: 5, windowMs: 60 * 60 * 1000 },   // 5 per hour
};

class SocialRateLimiter {
  private history: Map<string, number[]> = new Map();

  /**
   * Checks if an action is allowed for a user within the specified rate limit window
   */
  isAllowed(actionKey: string, userId: string, customConfig?: RateLimitConfig): { allowed: boolean; retryAfterMs?: number } {
    const config = customConfig || DEFAULT_LIMITS[actionKey] || { maxRequests: 30, windowMs: 60 * 1000 };
    const key = `${actionKey}:${userId}`;
    const now = Date.now();
    const timestamps = (this.history.get(key) || []).filter(ts => now - ts < config.windowMs);

    if (timestamps.length >= config.maxRequests) {
      const oldest = timestamps[0];
      const retryAfterMs = config.windowMs - (now - oldest);
      logger.warn(`Rate limit exceeded for action "${actionKey}" by user "${userId}"`, { retryAfterMs });
      return { allowed: false, retryAfterMs };
    }

    timestamps.push(now);
    this.history.set(key, timestamps);
    return { allowed: true };
  }

  /**
   * Resets rate limits for testing or administrative actions
   */
  reset(actionKey?: string, userId?: string): void {
    if (actionKey && userId) {
      this.history.delete(`${actionKey}:${userId}`);
    } else {
      this.history.clear();
    }
  }
}

export const rateLimiter = new SocialRateLimiter();
export default rateLimiter;
