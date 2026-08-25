import logger from '../utils/logger';

export interface AppNotification {
  id: string;
  userId: string;
  type: 'golden_hour' | 'weather_clear' | 'weekly_recap' | 'friend_invite';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export class NotificationRepository {
  async getNotifications(userId: string): Promise<AppNotification[]> {
    logger.info('Fetching notifications from repository', { userId });
    return [
      {
        id: 'notif_1',
        userId,
        type: 'golden_hour',
        title: 'Golden Hour Approaching',
        body: 'Sky conditions are clear in Kathmandu. Sunset starts at 18:45.',
        read: false,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  async markAsRead(notificationId: string): Promise<void> {
    logger.info('Marked notification read', { notificationId });
  }
}

export const notificationRepository = new NotificationRepository();
