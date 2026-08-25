// EXTROVELA — Native Firebase Services (Capacitor Plugins)
// These services are only available on native Android/iOS builds.
// On web, they gracefully degrade to console logging.

import { Capacitor } from '@capacitor/core';

/**
 * Capacitor Firebase Analytics wrapper.
 * Uses @capacitor-firebase/analytics on native, falls back to JS SDK on web.
 */
export async function logNativeEvent(eventName: string, params?: Record<string, string | number>): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
      await FirebaseAnalytics.logEvent({ name: eventName, params: params || {} });
    } catch (e) {
      console.warn('[EXTROVELA] Native analytics unavailable:', e);
    }
  }
}

/**
 * Capacitor Firebase Crashlytics wrapper.
 * Only available on native — no web equivalent exists.
 */
export async function logCrash(message: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseCrashlytics } = await import('@capacitor-firebase/crashlytics');
      await FirebaseCrashlytics.log({ message });
    } catch (e) {
      console.warn('[EXTROVELA] Crashlytics unavailable:', e);
    }
  } else {
    console.error('[EXTROVELA Crash]', message);
  }
}

export async function recordException(message: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseCrashlytics } = await import('@capacitor-firebase/crashlytics');
      await FirebaseCrashlytics.recordException({ message });
    } catch (e) {
      console.warn('[EXTROVELA] Crashlytics unavailable:', e);
    }
  } else {
    console.error('[EXTROVELA Exception]', message);
  }
}

export async function setCrashlyticsUserId(userId: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseCrashlytics } = await import('@capacitor-firebase/crashlytics');
      await FirebaseCrashlytics.setUserId({ userId });
    } catch (e) {
      console.warn('[EXTROVELA] Crashlytics unavailable:', e);
    }
  }
}

/**
 * Capacitor Firebase Performance wrapper.
 * On native, uses @capacitor-firebase/performance.
 * On web, uses the Firebase JS Performance SDK (initialized in firebase.ts).
 */
export async function startPerformanceTrace(traceName: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebasePerformance } = await import('@capacitor-firebase/performance');
      await FirebasePerformance.startTrace({ traceName });
    } catch (e) {
      console.warn('[EXTROVELA] Performance trace unavailable:', e);
    }
  }
}

export async function stopPerformanceTrace(traceName: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebasePerformance } = await import('@capacitor-firebase/performance');
      await FirebasePerformance.stopTrace({ traceName });
    } catch (e) {
      console.warn('[EXTROVELA] Performance trace unavailable:', e);
    }
  }
}
