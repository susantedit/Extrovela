/**
 * EXTROVELA — Admin Route Guard
 *
 * The /api/admin/* routes expose operational metrics and the full moderation
 * report queue (user-generated content). They must never be world-readable.
 *
 * This guard requires a shared secret presented as the `x-admin-key` header and
 * matched against process.env.ADMIN_SECRET_KEY with a length-safe constant-time
 * comparison.
 *
 * FAIL-CLOSED POSTURE:
 *   - production, ADMIN_SECRET_KEY unset → every admin request is refused (503).
 *     The dashboard is unreachable until a secret is configured, rather than
 *     silently open to the world.
 *   - development, ADMIN_SECRET_KEY unset → allowed with a loud warning, so
 *     local tooling is not blocked.
 *   - key set → the request must present a matching x-admin-key, else 401.
 */
import crypto from 'crypto';

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  // timingSafeEqual throws on length mismatch; short-circuit keeps it constant
  // time for equal-length inputs, which is the case that matters.
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function requireAdmin(req, res, next) {
  const configured = process.env.ADMIN_SECRET_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!configured) {
    if (isProduction) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'ADMIN_AUTH_NOT_CONFIGURED',
          message: 'Admin access is disabled until ADMIN_SECRET_KEY is configured on the server.',
        },
      });
    }
    console.warn('[EXTROVELA Admin] ADMIN_SECRET_KEY is not set — admin routes are OPEN in development only.');
    return next();
  }

  const presented = req.headers['x-admin-key'];
  if (!presented || !safeEqual(presented, configured)) {
    return res.status(401).json({
      success: false,
      error: { code: 'ADMIN_UNAUTHORIZED', message: 'A valid x-admin-key header is required.' },
    });
  }

  return next();
}

export default requireAdmin;
