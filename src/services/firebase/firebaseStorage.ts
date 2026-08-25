/**
 * EXTROVELA — Firebase Storage Service
 * 
 * Manages media uploads (memory snapshots, compressed images).
 */

import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFirebaseApp } from './firebaseConfig';
import logger from '../../utils/logger';

export class FirebaseStorageService {
  private getStorageInstance() {
    const app = getFirebaseApp();
    if (!app) return null;
    return getStorage(app);
  }

  async uploadMemoryPhoto(userId: string, memoryId: string, base64Data: string): Promise<string> {
    const storage = this.getStorageInstance();
    if (!storage) {
      // In local mode, return base64 data directly
      return base64Data;
    }

    try {
      const storageRef = ref(storage, `users/${userId}/memories/${memoryId}.jpg`);
      await uploadString(storageRef, base64Data, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);
      logger.info('Memory photo uploaded successfully to Firebase Storage');
      return downloadUrl;
    } catch (error) {
      logger.error('Failed to upload memory photo to storage', error);
      return base64Data;
    }
  }
}

export const firebaseStorage = new FirebaseStorageService();
export default firebaseStorage;
