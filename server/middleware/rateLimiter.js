/**
 * EXTROVELA — Sliding-Window Rate Limiter Middleware
 * 
 * Protects backend from DDoS, brute force, and expensive downstream API loops.
 */

const requestCounts = new Map();

/**
 * Creates an in-memory rate limiter
 * @param {Object} options
 * @param {number} options.windowMs - Time window in ms (e.g. 60000 = 1 minute)
 * @param {number} options.maxRequests - Max allowed requests per window
 * @param {string} options.message - Error message when rate-limited
 */
export function rateLimiter({ windowMs = 60000, maxRequests = 60, message = 'Too many requests. Please slow down.' } = {}) {
  return (req, res, next) => {
    const key = req.headers['x-user-id'] || req.ip || 'anonymous';
    const now = Date.now();

    if (!requestCounts.has(key)) {
      requestCounts.set(key, []);
    }

    const timestamps = requestCounts.get(key);
    // Remove expired timestamps
    const validTimestamps = timestamps.filter(time => now - time < windowMs);
    validTimestamps.push(now);
    requestCounts.set(key, validTimestamps);

    if (validTimestamps.length > maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message,
        },
      });
    }

    next();
  };
}

export default rateLimiter;
