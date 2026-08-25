import { UserProfile, UserPreferences } from '../types/user';
import { firestoreService } from '../services/firebase/firestore';
import logger from '../utils/logger';

export class UserRepository {
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      return await firestoreService.getUserProfile(userId);
    } catch (err) {
      logger.error('Failed to get user profile from repository', err);
      return null;
    }
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    try {
      await firestoreService.saveUserProfile(profile);
    } catch (err) {
      logger.error('Failed to save user profile in repository', err);
      throw err;
    }
  }

  async getPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      return await firestoreService.getUserPreferences(userId);
    } catch (err) {
      logger.error('Failed to get user preferences in repository', err);
      return null;
    }
  }

  async savePreferences(userId: string, preferences: UserPreferences): Promise<void> {
    try {
      await firestoreService.saveUserPreferences(userId, preferences);
    } catch (err) {
      logger.error('Failed to save user preferences in repository', err);
      throw err;
    }
  }
}

export const userRepository = new UserRepository();
