// EXTROVELA — Firebase Initialization (LEGACY COMPATIBILITY SHIM)
//
// DEPRECATED. The canonical Firebase entry points are:
//   - App:       src/services/firebase/firebaseConfig.ts    (getFirebaseApp)
//   - Analytics: src/services/firebase/firebaseAnalytics.ts (analytics.init / trackEvent)
//
// This module used to call initializeApp() with a HARDCODED PLACEHOLDER config,
// which registered a bogus Firebase app at startup and shadowed both the real
// credential path and the clean local-first fallback (MASTER_INTEGRATION_AUDIT
// §20). It now delegates to the single canonical initializer and NEVER registers
// an app of its own: with the default (placeholder) credentials getFirebaseApp()
// returns null, so nothing here initializes and the app runs local-first.
//
// Kept as a thin shim for backward compatibility; no module imports it as of
// this writing.

import { FirebaseApp } from 'firebase/app';
import { getAnalytics, Analytics, logEvent as firebaseLogEvent } from 'firebase/analytics';
import { getPerformance, FirebasePerformance } from 'firebase/performance';
import { getFirebaseApp } from '../services/firebase/firebaseConfig';

// ─── Singleton Instances ───────────────────────────────────
let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let performance: FirebasePerformance | null = null;

/**
 * Initialize web Analytics/Performance on top of the canonical Firebase app.
 * Safe to call multiple times, and safe to call with no credentials configured:
 * getFirebaseApp() returns null in local-first mode, so nothing is initialized.
 */
export function initFirebase(): void {
  if (app) return;

  app = getFirebaseApp();
  if (!app) return;

  try {
    if (typeof window !== 'undefined') {
      analytics = getAnalytics(app);
      performance = getPerformance(app);
    }
  } catch (error) {
    console.warn('[EXTROVELA] Firebase analytics/performance init skipped:', error);
  }
}

/**
 * Log a custom analytics event (web). No-op until initFirebase() has attached
 * analytics on a real Firebase app.
 */
export function logEvent(eventName: string, params?: Record<string, string | number>): void {
  if (analytics) {
    firebaseLogEvent(analytics, eventName, params);
  }
}

/**
 * Named EXTROVELA analytics events (reference catalogue).
 */
export const ExtravelaEvents = {
  questGenerated: (params: { time: string; mood: string; city: string }) =>
    logEvent('quest_generated', params),

  questAccepted: (questId: string, questTitle: string) =>
    logEvent('quest_accepted', { quest_id: questId, quest_title: questTitle }),

  questCompleted: (questId: string, moodRating: number) =>
    logEvent('quest_completed', { quest_id: questId, mood_rating: moodRating }),

  memorySaved: (questId: string, isFirstTime: boolean) =>
    logEvent('memory_saved', { quest_id: questId, first_time: isFirstTime ? 'yes' : 'no' }),

  phoneFreeActivated: () =>
    logEvent('phone_free_activated'),

  coQuestShared: (questId: string) =>
    logEvent('co_quest_shared', { quest_id: questId }),

  tabViewed: (tabName: string) =>
    logEvent('tab_viewed', { tab_name: tabName }),
};

export { app, analytics, performance };
