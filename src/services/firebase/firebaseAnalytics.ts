/**
 * EXTROVELA — Firebase Analytics & Telemetry Service
 * 
 * Strict typed event logging for product analytics and retention funnels.
 */

import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';
import { getPerformance } from 'firebase/performance';
import { getFirebaseApp } from './firebaseConfig';
import { AnalyticsEventName, AnalyticsEventParams } from '../../types/analytics';
import logger from '../../utils/logger';

export class FirebaseAnalyticsService {
  private analyticsInstance: any = null;

  async init(): Promise<void> {
    const app = getFirebaseApp();
    if (!app) return;
    try {
      if (await isSupported()) {
        this.analyticsInstance = getAnalytics(app);
        logger.info('Firebase Web Analytics initialized');
      }
      // Performance monitoring runs on the same canonical app. Best-effort; web only.
      if (typeof window !== 'undefined') {
        try {
          getPerformance(app);
        } catch {
          // Gracefully ignored if blocked by ad-blocker / client network policies
        }
      }
    } catch (e) {
      logger.warn('Firebase Analytics/Performance init skipped', { error: e });
    }
  }

  trackEvent(eventName: AnalyticsEventName, params?: AnalyticsEventParams): void {
    logger.debug(`[Analytics Event] ${eventName}`, params as Record<string, unknown>);
    if (this.analyticsInstance) {
      try {
        logEvent(this.analyticsInstance, eventName, params);
      } catch (e) {
        logger.warn(`Failed to log analytics event: ${eventName}`, { error: e });
      }
    }
  }
}

export const analytics = new FirebaseAnalyticsService();
export default analytics;
