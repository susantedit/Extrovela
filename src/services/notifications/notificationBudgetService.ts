import { AppNotification, NotificationPreferences } from '../../types/notification';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  dailyQuestEnabled: true,
  weatherOpportunitiesEnabled: true,
  questRemindersEnabled: true,
  groupQuestEnabled: true,
  friendActivityEnabled: true,
  memoryRemindersEnabled: false,
  weeklyRecapEnabled: true,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  maxDailyNotifications: 2,
  isPaused: false,
};

export class NotificationBudgetService {
  /**
   * Checks if current time is inside user quiet hours
   */
  static isQuietHours(prefs: NotificationPreferences, now = new Date()): boolean {
    if (!prefs.quietHoursEnabled) return false;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = prefs.quietHoursStart.split(':').map(Number);
    const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes > endMinutes) {
      // Overnight (e.g. 22:00 to 08:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  }

  /**
   * Evaluates if a notification is eligible to be delivered
   */
  static canDeliverNotification(
    notification: AppNotification,
    prefs: NotificationPreferences,
    sentTodayCount = 0,
    activeInApp = false,
    consecutiveIgnoredCount = 0
  ): { eligible: boolean; reason?: string } {
    if (prefs.isPaused) {
      if (prefs.pausedUntil && new Date(prefs.pausedUntil).getTime() < Date.now()) {
        prefs.isPaused = false;
      } else {
        return { eligible: false, reason: 'Notifications paused by user' };
      }
    }

    if (activeInApp && notification.type === 'dailyQuest') {
      return { eligible: false, reason: 'User actively in app; push suppressed' };
    }

    if (this.isQuietHours(prefs)) {
      return { eligible: false, reason: 'Quiet hours active' };
    }

    // Adaptive frequency reduction on repeated ignored notifications
    const effectiveLimit = consecutiveIgnoredCount >= 3 ? 1 : prefs.maxDailyNotifications;
    if (sentTodayCount >= effectiveLimit) {
      return { eligible: false, reason: 'Daily notification budget reached' };
    }

    // Category check
    switch (notification.type) {
      case 'dailyQuest':
        if (!prefs.dailyQuestEnabled) return { eligible: false, reason: 'Daily quest notifications disabled' };
        break;
      case 'weatherOpportunity':
        if (!prefs.weatherOpportunitiesEnabled) return { eligible: false, reason: 'Weather notifications disabled' };
        break;
      case 'questReminder':
      case 'savedQuest':
        if (!prefs.questRemindersEnabled) return { eligible: false, reason: 'Quest reminders disabled' };
        break;
      case 'groupQuest':
        if (!prefs.groupQuestEnabled) return { eligible: false, reason: 'Group quest notifications disabled' };
        break;
      case 'friendInvite':
        if (!prefs.friendActivityEnabled) return { eligible: false, reason: 'Friend activity notifications disabled' };
        break;
      case 'memoryReminder':
        if (!prefs.memoryRemindersEnabled) return { eligible: false, reason: 'Memory reminders disabled' };
        break;
      case 'weeklyRecap':
        if (!prefs.weeklyRecapEnabled) return { eligible: false, reason: 'Weekly recap disabled' };
        break;
      default:
        break;
    }

    return { eligible: true };
  }

  static createPausedPreferences(days: number, currentPrefs: NotificationPreferences): NotificationPreferences {
    const pausedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    return {
      ...currentPrefs,
      isPaused: true,
      pausedUntil,
    };
  }
}

export default NotificationBudgetService;
