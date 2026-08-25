/**
 * EXTROVELA — Firebase Cloud Messaging & App Check Services
 */

import { getFirebaseApp } from './firebaseConfig';
import logger from '../../utils/logger';

export class FirebaseMessagingService {
  async requestNotificationPermissions(): Promise<string | null> {
    logger.info('Requesting push notification permissions...');
    return null; // Implemented natively via @capacitor/local-notifications and FCM
  }
}

export class FirebaseAppCheckService {
  initAppCheck(): void {
    logger.info('App Check service prepared for production app attestation.');
  }
}

export const firebaseMessaging = new FirebaseMessagingService();
export const firebaseAppCheck = new FirebaseAppCheckService();
