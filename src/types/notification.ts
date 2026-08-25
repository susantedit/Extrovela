/**
 * EXTROVELA — Notification & Smart Delivery Contracts (Phase 10)
 * 
 * Non-addictive, privacy-safe notification models, user preferences,
 * quiet-hour configurations, and opportunity scoring models.
 */

export type NotificationType =
  | 'dailyQuest'
  | 'weatherOpportunity'
  | 'timeOpportunity'
  | 'savedQuest'
  | 'questReminder'
  | 'groupQuest'
  | 'friendInvite'
  | 'sharedExperience'
  | 'memoryReminder'
  | 'weeklyRecap';

export type NotificationPriority = 'low' | 'normal' | 'high';

export type NotificationStatus =
  | 'scheduled'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'dismissed'
  | 'expired'
  | 'cancelled'
  | 'failed';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;
  deepLink?: string;
  status: NotificationStatus;
  scheduledAt?: string;
  sentAt?: string;
  readAt?: string;
  expiresAt?: string;
  dedupeKey: string;
  createdAt: string;
}

export interface NotificationPreferences {
  dailyQuestEnabled: boolean;
  weatherOpportunitiesEnabled: boolean;
  questRemindersEnabled: boolean;
  groupQuestEnabled: boolean;
  friendActivityEnabled: boolean;
  memoryRemindersEnabled: boolean;
  weeklyRecapEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "08:00"
  maxDailyNotifications: number;
  isPaused: boolean;
  pausedUntil?: string;
}

export interface UserDevice {
  id: string;
  userId: string;
  pushToken: string;
  platform: 'android' | 'ios' | 'web';
  timezone: string; // e.g. "Asia/Kathmandu"
  enabled: boolean;
  lastSeenAt: string;
}

export interface NotificationOpportunityScore {
  relevance: number;      // 0 to 10
  timeliness: number;     // 0 to 10
  weatherAlignment: number; // 0 to 10
  novelty: number;        // 0 to 10
  userPreferenceMatch: number; // 0 to 10
  frequencyPenalty: number; // 0 to 10
  totalScore: number;     // Sum after penalties
  passedThreshold: boolean; // Must be >= 25 to send
  internalReason: string;
}
