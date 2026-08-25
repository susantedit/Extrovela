import { AppNotification, NotificationOpportunityScore, NotificationPreferences } from '../../types/notification';
import { NotificationBudgetService, DEFAULT_NOTIFICATION_PREFERENCES } from './notificationBudgetService';
import { notificationManager } from './notificationManager';
import { deriveSocialNotifications } from '../social/socialNotifications';
import logger from '../../utils/logger';

export class DailyQuestService {
  private static localInbox: AppNotification[] = [
    {
      id: 'notif_sunset_kathmandu',
      userId: 'user_active',
      type: 'weatherOpportunity',
      title: 'Clear skies this evening',
      body: 'Sunset is approaching in 45 minutes. A quiet rooftop or viewpoint is waiting.',
      priority: 'normal',
      deepLink: 'extrovela://quest/sunset_viewpoint',
      status: 'sent',
      sentAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      dedupeKey: `weather:user_active:${new Date().toISOString().split('T')[0]}:sunset`,
      createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    },
    {
      id: 'notif_welcome_discovery',
      userId: 'user_active',
      type: 'dailyQuest',
      title: 'A small adventure nearby',
      body: 'Take 20 minutes to explore a quiet stone courtyard you haven’t logged a memory from.',
      priority: 'normal',
      deepLink: 'extrovela://quest/courtyard_discovery',
      status: 'sent',
      sentAt: new Date(Date.now() - 86400 * 1000).toISOString(),
      dedupeKey: `daily:user_active:${new Date().toISOString().split('T')[0]}`,
      createdAt: new Date(Date.now() - 86400 * 1000).toISOString(),
    },
  ];

  private static userPreferencesMap: Map<string, NotificationPreferences> = new Map();

  static async getPreferences(userId: string): Promise<NotificationPreferences> {
    return this.userPreferencesMap.get(userId) || { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  static async updatePreferences(userId: string, prefs: NotificationPreferences): Promise<NotificationPreferences> {
    this.userPreferencesMap.set(userId, prefs);
    logger.info('Updated user notification preferences', { userId });
    return prefs;
  }

  static async getNotificationInbox(userId: string): Promise<AppNotification[]> {
    const local = this.localInbox.filter(
      n => (n.userId === userId || n.userId === 'user_active') && n.status !== 'dismissed'
    );

    // Project authorized social state into the SAME inbox (Phase 14). Derived,
    // never cross-written; fail-soft so a social read never breaks the inbox.
    let derived: AppNotification[] = [];
    try {
      derived = await deriveSocialNotifications(userId);
    } catch (err) {
      logger.warn('Social notification derivation failed', { err: (err as Error).message });
    }

    const seen = new Set(local.map(n => n.id));
    const merged = [...local];
    for (const d of derived) {
      if (!seen.has(d.id)) merged.push(d);
    }

    // Newest first; missing timestamps sort last.
    merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return merged;
  }

  static async markAsRead(notificationId: string): Promise<void> {
    const item = this.localInbox.find(n => n.id === notificationId);
    if (item) {
      item.readAt = new Date().toISOString();
      item.status = 'opened';
    }
  }

  static async dismissNotification(notificationId: string): Promise<void> {
    const item = this.localInbox.find(n => n.id === notificationId);
    if (item) {
      item.status = 'dismissed';
    }
  }

  /**
   * Internal Opportunity Scoring Algorithm
   */
  static calculateOpportunityScore(params: {
    isSunsetTime?: boolean;
    weatherClear?: boolean;
    unvisitedLocation?: boolean;
    preferenceMatch?: boolean;
    sentTodayCount?: number;
  }): NotificationOpportunityScore {
    const relevance = params.preferenceMatch ? 8 : 4;
    const timeliness = params.isSunsetTime ? 9 : 5;
    const weatherAlignment = params.weatherClear ? 9 : 4;
    const novelty = params.unvisitedLocation ? 8 : 3;
    const userPreferenceMatch = params.preferenceMatch ? 9 : 5;
    const frequencyPenalty = (params.sentTodayCount || 0) * 4;

    const totalScore = relevance + timeliness + weatherAlignment + novelty + userPreferenceMatch - frequencyPenalty;
    const passedThreshold = totalScore >= 25;

    const internalReason = `score:${totalScore} (sunset:${params.isSunsetTime ? 'yes' : 'no'}, weather:${params.weatherClear ? 'clear' : 'cloudy'}, unvisited:${params.unvisitedLocation ? 'yes' : 'no'})`;

    return {
      relevance,
      timeliness,
      weatherAlignment,
      novelty,
      userPreferenceMatch,
      frequencyPenalty,
      totalScore,
      passedThreshold,
      internalReason,
    };
  }

  static async scheduleDailyOpportunity(userId: string): Promise<AppNotification | null> {
    const prefs = await this.getPreferences(userId);
    const dateStr = new Date().toISOString().split('T')[0];
    const dedupeKey = `daily:${userId}:${dateStr}`;

    const existing = this.localInbox.find(n => n.dedupeKey === dedupeKey);
    if (existing) {
      logger.info('Daily quest already delivered for today', { dedupeKey });
      return existing;
    }

    const currentCount = this.localInbox.filter(n => n.userId === userId && n.sentAt?.startsWith(dateStr)).length;
    const dummyNotif: AppNotification = {
      id: '',
      userId,
      type: 'dailyQuest',
      title: '',
      body: '',
      priority: 'normal',
      status: 'scheduled',
      dedupeKey,
      createdAt: '',
    };

    const gateCheck = NotificationBudgetService.canDeliverNotification(dummyNotif, prefs, currentCount);
    if (!gateCheck.eligible) {
      logger.info('Suppressed daily notification', { reason: gateCheck.reason });
      return null;
    }

    const score = this.calculateOpportunityScore({
      isSunsetTime: true,
      weatherClear: true,
      unvisitedLocation: true,
      preferenceMatch: true,
      sentTodayCount: currentCount,
    });

    if (!score.passedThreshold) {
      logger.info('Suppressed daily notification due to low opportunity score', { reason: score.internalReason });
      return null;
    }

    const notification: AppNotification = {
      id: `notif_${Date.now()}`,
      userId,
      type: 'dailyQuest',
      title: 'Your daily possibility is ready',
      body: 'A thoughtful 25-minute experience matching your mood is waiting.',
      priority: 'normal',
      deepLink: 'extrovela://quest/daily_today',
      status: 'sent',
      sentAt: new Date().toISOString(),
      dedupeKey,
      createdAt: new Date().toISOString(),
    };

    this.localInbox.unshift(notification);
    await notificationManager.dispatchNotification(userId, notification);
    return notification;
  }

  static async scheduleWeatherOpportunity(userId: string, weatherCondition = 'Clear'): Promise<AppNotification | null> {
    const prefs = await this.getPreferences(userId);
    const dateStr = new Date().toISOString().split('T')[0];
    const dedupeKey = `weather:${userId}:${dateStr}:${weatherCondition.toLowerCase()}`;

    const existing = this.localInbox.find(n => n.dedupeKey === dedupeKey);
    if (existing) return existing;

    const currentCount = this.localInbox.filter(n => n.userId === userId && n.sentAt?.startsWith(dateStr)).length;
    const dummyNotif: AppNotification = {
      id: '',
      userId,
      type: 'weatherOpportunity',
      title: '',
      body: '',
      priority: 'normal',
      status: 'scheduled',
      dedupeKey,
      createdAt: '',
    };

    const gateCheck = NotificationBudgetService.canDeliverNotification(dummyNotif, prefs, currentCount);
    if (!gateCheck.eligible) return null;

    const notification: AppNotification = {
      id: `notif_w_${Date.now()}`,
      userId,
      type: 'weatherOpportunity',
      title: `Clear skies & ${weatherCondition.toLowerCase()} weather`,
      body: 'Ideal conditions for a quiet evening walk near a viewpoint.',
      priority: 'normal',
      deepLink: 'extrovela://quest/sunset_viewpoint',
      status: 'sent',
      sentAt: new Date().toISOString(),
      dedupeKey,
      createdAt: new Date().toISOString(),
    };

    this.localInbox.unshift(notification);
    await notificationManager.dispatchNotification(userId, notification);
    return notification;
  }

  static async scheduleQuestReminder(userId: string, questId: string, questTitle: string): Promise<AppNotification | null> {
    const prefs = await this.getPreferences(userId);
    const dedupeKey = `questReminder:${userId}:${questId}`;

    const existing = this.localInbox.find(n => n.dedupeKey === dedupeKey);
    if (existing) return existing; // Max 1 reminder per quest

    const dummyNotif: AppNotification = {
      id: '',
      userId,
      type: 'questReminder',
      title: '',
      body: '',
      priority: 'normal',
      status: 'scheduled',
      dedupeKey,
      createdAt: '',
    };

    const gateCheck = NotificationBudgetService.canDeliverNotification(dummyNotif, prefs, 0);
    if (!gateCheck.eligible) return null;

    const notification: AppNotification = {
      id: `notif_rem_${Date.now()}`,
      userId,
      type: 'questReminder',
      title: 'Your little adventure is waiting',
      body: `"${questTitle}" is ready whenever you feel like stepping out. No rush.`,
      priority: 'normal',
      deepLink: `extrovela://quest/${questId}`,
      status: 'sent',
      sentAt: new Date().toISOString(),
      dedupeKey,
      createdAt: new Date().toISOString(),
    };

    this.localInbox.unshift(notification);
    await notificationManager.dispatchNotification(userId, notification);
    return notification;
  }

  static async scheduleReengagement(userId: string): Promise<AppNotification | null> {
    const prefs = await this.getPreferences(userId);
    const dateStr = new Date().toISOString().split('T')[0];
    const dedupeKey = `reengage:${userId}:${dateStr}`;

    const existing = this.localInbox.find(n => n.dedupeKey === dedupeKey);
    if (existing) return existing;

    const dummyNotif: AppNotification = {
      id: '',
      userId,
      type: 'timeOpportunity',
      title: '',
      body: '',
      priority: 'low',
      status: 'scheduled',
      dedupeKey,
      createdAt: '',
    };

    const gateCheck = NotificationBudgetService.canDeliverNotification(dummyNotif, prefs, 0);
    if (!gateCheck.eligible) return null;

    const notification: AppNotification = {
      id: `notif_re_${Date.now()}`,
      userId,
      type: 'timeOpportunity',
      title: 'Clear skies tonight',
      body: 'There is a quiet place nearby you might enjoy whenever you have 20 free minutes.',
      priority: 'low',
      deepLink: 'extrovela://quest/quiet_escape',
      status: 'sent',
      sentAt: new Date().toISOString(),
      dedupeKey,
      createdAt: new Date().toISOString(),
    };

    this.localInbox.unshift(notification);
    await notificationManager.dispatchNotification(userId, notification);
    return notification;
  }
}

export default DailyQuestService;
