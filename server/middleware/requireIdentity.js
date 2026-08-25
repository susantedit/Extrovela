/**
 * EXTROVELA — Phase 11: Request Identity Middleware
 *
 * Establishes `req.auth = { userId, verified }` for intelligence routes.
 *
 * ────────────────────────────────────────────────────────────────
 * HONEST STATUS: SERVER-SIDE TOKEN VERIFICATION IS **NOT IMPLEMENTED**
 *                — IT **REQUIRES EXTERNAL CONFIGURATION**.
 * ────────────────────────────────────────────────────────────────
 *
 * `firebase-admin` is not a dependency of this backend, so there is currently no
 * way to cryptographically verify a Firebase ID token here. This middleware is
 * written so that verification becomes real the moment the dependency and
 * service-account credentials are added — no route changes needed.
 *
 * Until then it FAILS CLOSED in production:
 *
 *   - `firebase-admin` present + credentials configured
 *         → token verified, req.auth.verified = true
 *   - not present, NODE_ENV !== 'production'
 *         → userId taken from the header, req.auth.verified = false (dev only)
 *   - not present, NODE_ENV === 'production', TRUST_CLIENT_USER_ID !== 'true'
 *         → 501 Not Implemented. The route refuses to serve rather than
 *           pretending an unauthenticated caller is who they claim to be.
 *
 * The reason this matters for Phase 11 specifically: an unverified userId means
 * an attacker could request another user's personalization. The bundle itself is
 * sent by the client and never read from another user's storage server-side, so
 * there is no cross-user read here — but generation would still be attributable
 * to the wrong account, so we do not allow it in production by default.
 */

let adminModule = null;
let adminInitAttempted = false;
let adminAvailable = false;

async function getFirebaseAdmin() {
  if (adminInitAttempted) return adminAvailable ? adminModule : null;
  adminInitAttempted = true;

  try {
    // Optional dependency: absent by design until someone configures it.
    const admin = await import('firebase-admin/auth');
    const appModule = await import('firebase-admin/app');

    const hasCredentials =
      Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
      Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

    if (!hasCredentials) {
      console.warn(
        '[EXTROVELA Auth] firebase-admin is installed but no credentials are configured. ' +
          'Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON to enable token verification.'
      );
      return null;
    }

    if (appModule.getApps().length === 0) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      appModule.initializeApp(
        raw
          ? { credential: appModule.cert(JSON.parse(raw)) }
          : { credential: appModule.applicationDefault() }
      );
    }

    adminModule = admin;
    adminAvailable = true;
    console.log('[EXTROVELA Auth] Firebase ID token verification ENABLED.');
    return adminModule;
  } catch {
    console.warn(
      '[EXTROVELA Auth] firebase-admin not installed — server-side token verification is NOT ACTIVE. ' +
        'Intelligence routes will refuse unverified requests in production.'
    );
    return null;
  }
}

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 20 ? token : null;
}

/** Basic shape check so a malformed id cannot reach a Firestore path. */
function isPlausibleUserId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{4,128}$/.test(value);
}

export async function requireIdentity(req, res, next) {
  const admin = await getFirebaseAdmin();
  const token = extractBearerToken(req);

  // Path 1 — real verification.
  if (admin && token) {
    try {
      const decoded = await admin.getAuth().verifyIdToken(token);
      req.auth = { userId: decoded.uid, verified: true };
      return next();
    } catch {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Authentication token is invalid or expired.' },
      });
    }
  }

  if (admin && !token) {
    return res.status(401).json({
      success: false,
      error: { code: 'MISSING_TOKEN', message: 'Authorization: Bearer <idToken> is required.' },
    });
  }

  // Path 2 — no verification available.
  const claimed = req.headers['x-user-id'] || req.body?.userId;
  const isProduction = process.env.NODE_ENV === 'production';
  const explicitlyTrusted = process.env.TRUST_CLIENT_USER_ID === 'true';

  if (isProduction && !explicitlyTrusted) {
    return res.status(501).json({
      success: false,
      error: {
        code: 'AUTH_NOT_IMPLEMENTED',
        message:
          'Server-side authentication is not configured. Install firebase-admin and set ' +
          'GOOGLE_APPLICATION_CREDENTIALS (or FIREBASE_SERVICE_ACCOUNT_JSON) to enable this endpoint.',
      },
    });
  }

  if (!isPlausibleUserId(claimed)) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_USER_ID', message: 'A valid x-user-id header is required.' },
    });
  }

  req.auth = { userId: claimed, verified: false };
  return next();
}

/**
 * Guards against a caller acting on behalf of a different user. Any userId in
 * the body must match the authenticated identity.
 */
export function enforceSelfOnly(req, res, next) {
  const bodyUserId = req.body?.userId;
  if (bodyUserId && bodyUserId !== req.auth?.userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CROSS_USER_REQUEST_DENIED',
        message: 'A request may only reference the authenticated user.',
      },
    });
  }
  return next();
}

export default { requireIdentity, enforceSelfOnly };
