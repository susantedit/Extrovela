/**
 * EXTROVELA — Modular Firebase Configuration & App Initializer
 * 
 * Safely initializes the Firebase JavaScript SDK and provides fallback
 * mock instances if credentials have not been configured yet.
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import config from '../../config/env';
import logger from '../../utils/logger';

let appInstance: FirebaseApp | null = null;
let loggedFallback = false;

/**
 * Returns the one Firebase app for the whole client, or `null` when no real
 * credentials are configured (the default), in which case every consumer
 * (Auth, Firestore, Analytics) must fall back to local persistence.
 *
 * This is the single source of truth for Firebase initialization. The
 * credential check runs BEFORE `getApps()` is consulted, so a placeholder app
 * registered by any other module can never be mistaken for a configured
 * project and handed back here — the double-init defect where a bogus app
 * shadowed both the real-credential path and the clean local-first fallback.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (appInstance) return appInstance;

  if (!config.firebase.apiKey || config.firebase.apiKey === 'placeholder-api-key') {
    if (!loggedFallback) {
      logger.info('Firebase configured with placeholder credentials. Operating in local-first fallback mode.');
      loggedFallback = true;
    }
    return null;
  }

  try {
    const existingApps = getApps();
    appInstance = existingApps.length > 0 ? existingApps[0] : initializeApp(config.firebase);
    logger.info('Firebase App ready.');
    return appInstance;
  } catch (error) {
    logger.warn('Failed to initialize Firebase App. Continuing with local persistence.', { error });
    return null;
  }
}
