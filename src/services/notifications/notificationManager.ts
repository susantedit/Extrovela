/**
 * EXTROVELA — Notification Provider & Device Token Manager (Phase 10)
 * 
 * Abstraction layer for push notification providers (FCM / Expo Push) and user
 * device token registration, validation, and invalid token cleanup.
 */

import { UserDevice, AppNotification } from '../../types/notification';
import logger from '../../utils/logger';

export interface NotificationProvider {
  sendPush(deviceToken: string, notification: AppNotification): Promise<boolean>;
}

class MockFCMProvider implements NotificationProvider {
  async sendPush(deviceToken: string, notification: AppNotification): Promise<boolean> {
    if (deviceToken.includes('invalid') || deviceToken.includes('expired')) {
      logger.warn('Mock FCM Provider: Token invalid or expired', { deviceToken });
      return false;
    }
    logger.info('Mock FCM Provider: Push sent successfully', { deviceToken, notifId: notification.id });
    return true;
  }
}

export class NotificationManager {
  private devices: Map<string, UserDevice> = new Map();
  private provider: NotificationProvider = new MockFCMProvider();

  constructor() {
    // Register default mock active user device
    const sampleDevice: UserDevice = {
      id: 'dev_kathmandu_mobile',
      userId: 'user_active',
      pushToken: 'fcm_token_sample_kathmandu_123',
      platform: 'android',
      timezone: 'Asia/Kathmandu',
      enabled: true,
      lastSeenAt: new Date().toISOString(),
    };
    this.devices.set(sampleDevice.id, sampleDevice);
  }

  async registerDeviceToken(
    userId: string,
    pushToken: string,
    platform: 'android' | 'ios' | 'web' = 'android',
    timezone = 'Asia/Kathmandu'
  ): Promise<UserDevice> {
    const deviceId = `dev_${userId}_${platform}`;
    const device: UserDevice = {
      id: deviceId,
      userId,
      pushToken,
      platform,
      timezone,
      enabled: true,
      lastSeenAt: new Date().toISOString(),
    };

    this.devices.set(deviceId, device);
    logger.info('Device token registered', { userId, deviceId, platform, timezone });
    return device;
  }

  async getUserDevices(userId: string): Promise<UserDevice[]> {
    const result: UserDevice[] = [];
    this.devices.forEach(d => {
      if (d.userId === userId && d.enabled) {
        result.push(d);
      }
    });
    return result;
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        logger.info('[EXTROVELA Notifications] Web notification permission status', { permission });
        return permission === 'granted';
      } catch (err) {
        logger.warn('[EXTROVELA Notifications] Failed to request web notification permission', { err });
      }
    }
    return false;
  }

  async dispatchNotification(userId: string, notification: AppNotification): Promise<boolean> {
    // 1. Dispatch Real Web Notification if running in browser & permission granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(notification.title, {
          body: notification.body,
          icon: '/logo.png',
          tag: notification.id,
        });
        logger.info('[EXTROVELA Notifications] Real Web Notification delivered', { id: notification.id });
      } catch (err) {
        logger.warn('[EXTROVELA Notifications] Failed Web Notification popup', { err });
      }
    }

    const devices = await this.getUserDevices(userId);
    if (devices.length === 0) {
      logger.info('No active enabled devices for user', { userId });
      return true;
    }

    let anySuccess = false;
    for (const dev of devices) {
      const success = await this.provider.sendPush(dev.pushToken, notification);
      if (success) {
        anySuccess = true;
      } else {
        // Disable invalid token automatically
        dev.enabled = false;
        logger.info('Disabled invalid device token', { deviceId: dev.id });
      }
    }

    return anySuccess;
  }
}

export const notificationManager = new NotificationManager();
export default notificationManager;
