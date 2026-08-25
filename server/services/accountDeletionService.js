/**
 * EXTROVELA — Cascading Account Deletion Service
 * (Phase 4, extended in Phase 11 for derived personalization data)
 *
 * Complies with Apple App Store Guideline 5.1.1 & GDPR Right to Erasure.
 *
 * ────────────────────────────────────────────────────────────────
 * HONEST STATUS: SERVER-SIDE PURGE IS **NOT IMPLEMENTED** —
 *                IT **REQUIRES EXTERNAL CONFIGURATION**.
 * ────────────────────────────────────────────────────────────────
 *
 * `firebase-admin` is not a dependency of this backend, so this process has no
 * privileged handle on Firestore or Storage and CANNOT delete anything there.
 *
 * What actually happens today:
 *   - The CLIENT performs the deletion, signed in as the user, through
 *     src/services/intelligence/intelligenceFirestore.ts → deleteAllIncludingRaw()
 *     and the Phase 4 client deletion path. Firestore rules permit a user to
 *     delete their own subcollections, so this genuinely works — but only while
 *     the app is open and the user is authenticated.
 *   - This service returns the DELETION MANIFEST: the authoritative list of
 *     every path that must be purged. The client uses it as its checklist, and
 *     it is what an operator would hand to a support tool.
 *
 * The result object no longer claims success for work it did not do. Callers must
 * read `serverSidePurgePerformed` — when false, the client remains responsible
 * and any UI must not tell the user their data is gone until the client reports
 * completion.
 *
 * To make this real: `cd server && npm install firebase-admin`, set
 * GOOGLE_APPLICATION_CREDENTIALS, and the privileged path below activates with
 * no caller changes.
 */

/**
 * Raw, user-authored data. Deleting this is the user's actual intent.
 */
export const RAW_SUBCOLLECTIONS = [
  'preferences',
  'quests',
  'questAttempts',
  'memories',
  'reflections',
  'exploration',
  'notifications',
  'deviceTokens',
  'recaps',
  // Holds `settings/personalization`, i.e. the user's personalization kill switch
  // and any explicitly stated preferences.
  'settings',
  'memoryMedia',
  'memoryCollections',
  'experienceRecaps',
  'shareTokens',
];

/**
 * Phase 11 derived data. This is inferred ABOUT the user rather than authored BY
 * them, and it is exactly what a "delete my account" request most often
 * overlooks. Every one of these is reconstructable from raw events, which is
 * precisely why leaving them behind would be a real privacy failure: the profile
 * would survive the data it was derived from.
 */
export const DERIVED_SUBCOLLECTIONS = [
  'experienceEvents',
  'preferenceSignals',
  'experienceGraphNodes',
  'experienceGraphEdges',
  'experienceProfile',
  'experienceMemories',
  'experienceJobs',
  'reflectionInsights',
];

export const STORAGE_PREFIXES = ['users/{userId}/memories/', 'users/{userId}/'];

/**
 * Builds the full list of paths that constitute a complete erasure.
 * Pure function — safe to call for an audit without deleting anything.
 */
export function buildDeletionManifest(userId) {
  return {
    userId,
    firestoreDocuments: [`users/${userId}`],
    firestoreSubcollections: [
      ...RAW_SUBCOLLECTIONS.map(name => ({ path: `users/${userId}/${name}`, kind: 'raw' })),
      ...DERIVED_SUBCOLLECTIONS.map(name => ({ path: `users/${userId}/${name}`, kind: 'derived' })),
    ],
    storagePrefixes: STORAGE_PREFIXES.map(p => p.replace('{userId}', userId)),
    // Server-side data keyed by userId that lives outside Firestore.
    serverSideStores: [
      { store: 'mongodb', collection: 'memories', filter: { userId } },
      { store: 'mongodb', collection: 'quests', filter: { userId } },
      { store: 'in-memory', name: 'rateLimiter buckets', note: 'expires on its own' },
      { store: 'in-memory', name: 'quest cache', note: 'per-user key, expires in 10 minutes' },
    ],
    authAccount: { provider: 'firebase-auth', uid: userId },
  };
}

let adminAttempted = false;
let firestoreAdmin = null;

async function getPrivilegedFirestore() {
  if (adminAttempted) return firestoreAdmin;
  adminAttempted = true;

  const hasCredentials =
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
    Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!hasCredentials) return null;

  try {
    const appModule = await import('firebase-admin/app');
    const firestoreModule = await import('firebase-admin/firestore');

    if (appModule.getApps().length === 0) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      appModule.initializeApp(
        raw
          ? { credential: appModule.cert(JSON.parse(raw)) }
          : { credential: appModule.applicationDefault() }
      );
    }

    firestoreAdmin = firestoreModule.getFirestore();
    return firestoreAdmin;
  } catch {
    return null;
  }
}

/** Deletes every document in one subcollection, in batches. */
async function purgeSubcollection(db, path) {
  let deleted = 0;
  for (;;) {
    const snapshot = await db.collection(path).limit(400).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;

    if (snapshot.size < 400) break;
  }
  return deleted;
}

/**
 * Purges all data for one user.
 *
 * @returns {Promise<{
 *   userId: string,
 *   serverSidePurgePerformed: boolean,
 *   clientMustComplete: boolean,
 *   status: 'purged' | 'manifest-only',
 *   deletedCounts?: Record<string, number>,
 *   manifest: object,
 *   notImplemented?: string[],
 *   timestamp: string
 * }>}
 */
export async function deleteUserAccountData(userId) {
  if (!userId) throw new Error('User ID is required for deletion');
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(userId)) {
    throw new Error('User ID has an unexpected shape; refusing to build deletion paths from it');
  }

  const manifest = buildDeletionManifest(userId);
  const db = await getPrivilegedFirestore();

  // ─── Privileged path: real deletion ───
  if (db) {
    const deletedCounts = {};
    const failures = [];

    for (const entry of manifest.firestoreSubcollections) {
      try {
        deletedCounts[entry.path] = await purgeSubcollection(db, entry.path);
      } catch (error) {
        failures.push({ path: entry.path, error: error.message });
      }
    }

    try {
      await db.doc(`users/${userId}`).delete();
      deletedCounts[`users/${userId}`] = 1;
    } catch (error) {
      failures.push({ path: `users/${userId}`, error: error.message });
    }

    // Log counts only — never document contents.
    console.log(
      `[AccountDeletion] Purged ${Object.values(deletedCounts).reduce((a, b) => a + b, 0)} documents for one user; ${failures.length} failures.`
    );

    return {
      userId,
      serverSidePurgePerformed: true,
      clientMustComplete: false,
      status: 'purged',
      deletedCounts,
      failures,
      manifest,
      notImplemented: [
        'Firebase Storage object deletion — requires the firebase-admin Storage SDK and a configured bucket name.',
        'Firebase Auth account deletion — requires admin.auth().deleteUser(uid).',
      ],
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Unprivileged path: manifest only ───
  // No console.log claiming a purge happened. It did not.
  console.warn(
    `[AccountDeletion] Deletion requested but server-side purge is NOT CONFIGURED. ` +
      `Returning a manifest of ${manifest.firestoreSubcollections.length} subcollections for the client to erase. ` +
      `Install firebase-admin and set GOOGLE_APPLICATION_CREDENTIALS to purge server-side.`
  );

  return {
    userId,
    serverSidePurgePerformed: false,
    clientMustComplete: true,
    status: 'manifest-only',
    manifest,
    notImplemented: [
      'Server-side Firestore purge — REQUIRES EXTERNAL CONFIGURATION (firebase-admin + service-account credentials).',
      'Firebase Storage object deletion — REQUIRES EXTERNAL CONFIGURATION.',
      'Firebase Auth account deletion — REQUIRES EXTERNAL CONFIGURATION.',
      'MongoDB purge of memories/quests keyed by userId — NOT IMPLEMENTED here; the client owns Firestore, and the Mongo store is a fallback cache.',
    ],
    timestamp: new Date().toISOString(),
  };
}

export default { deleteUserAccountData, buildDeletionManifest, RAW_SUBCOLLECTIONS, DERIVED_SUBCOLLECTIONS };
