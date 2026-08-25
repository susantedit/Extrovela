import { FriendProfile, ReportReason, UserReport, UserBlock, Friendship } from '../../types/social';
import { socialRepository } from '../../repositories/SocialRepository';
import { rateLimiter } from './rateLimiter';
import logger from '../../utils/logger';

export class SocialService {
  static async getFriends(userId: string): Promise<FriendProfile[]> {
    return socialRepository.getFriends(userId);
  }

  static async getPendingRequests(userId: string): Promise<Friendship[]> {
    return socialRepository.getPendingRequests(userId);
  }

  static async sendFriendRequest(fromUserId: string, toUserId: string): Promise<Friendship> {
    const check = rateLimiter.isAllowed('friend_request', fromUserId);
    if (!check.allowed) {
      throw new Error(`Rate limit exceeded for friend requests. Please wait ${Math.ceil((check.retryAfterMs || 0) / 1000)} seconds.`);
    }

    return socialRepository.sendFriendRequest(fromUserId, toUserId);
  }

  static async acceptFriendRequest(friendshipId: string): Promise<void> {
    return socialRepository.acceptFriendRequest(friendshipId);
  }

  static async declineFriendRequest(friendshipId: string): Promise<void> {
    return socialRepository.declineFriendRequest(friendshipId);
  }

  static async removeFriend(userId: string, friendId: string): Promise<void> {
    return socialRepository.removeFriend(userId, friendId);
  }

  static async searchUserByHandle(handleQuery: string, currentUserId: string): Promise<FriendProfile | null> {
    const check = rateLimiter.isAllowed('handle_search', currentUserId);
    if (!check.allowed) {
      logger.warn('Search rate limit hit for user', { currentUserId });
      return null;
    }

    return socialRepository.searchUserByHandle(handleQuery, currentUserId);
  }

  static async blockUser(blockerId: string, blockedId: string): Promise<UserBlock> {
    return socialRepository.blockUser(blockerId, blockedId);
  }

  static async reportUser(
    reporterId: string,
    reportedUserId: string,
    reason: ReportReason,
    description?: string,
    relatedQuestId?: string
  ): Promise<UserReport> {
    const check = rateLimiter.isAllowed('report_submit', reporterId);
    if (!check.allowed) {
      throw new Error('Report rate limit exceeded. Your safety report has been logged locally.');
    }

    return socialRepository.reportUser({
      reporterId,
      reportedUserId,
      reason,
      description,
      relatedQuestId,
    });
  }
}

export default SocialService;
