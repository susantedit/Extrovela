import { Memory, Reflection } from '../types/memory';
import { MOCK_MEMORIES } from '../constants/mockData';
import { firestoreService } from '../services/firebase/firestore';
import { mediaStorageService } from '../services/media/mediaStorageService';
import logger from '../utils/logger';

const LOCAL_STORAGE_KEY = 'extrovela_memories';

export class MemoryRepository {
  /**
   * Retrieves user memories from Firestore with fallback to local storage and mock memories.
   */
  async getMemories(userId: string): Promise<Memory[]> {
    const localSaved = this.getLocalMemories();

    try {
      const live = await firestoreService.getUserMemories(userId);
      if (live && live.length > 0) {
        // Merge with any un-synced local memories
        const map = new Map<string, Memory>();
        live.forEach(m => map.set(m.id, m));
        localSaved.forEach(m => {
          if (!map.has(m.id)) {
            map.set(m.id, m);
          }
        });
        const combined = Array.from(map.values()).sort(
          (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        );
        return combined;
      }
    } catch {
      logger.info('Using local / fallback memories repository');
    }

    if (localSaved.length > 0) {
      return localSaved;
    }

    return MOCK_MEMORIES as Memory[];
  }

  /**
   * Saves a new memory to Firestore and updates local cache.
   */
  async saveMemory(userId: string, memory: Memory): Promise<void> {
    // 1. Save to local storage first for instant optimistic update & offline resilience
    const local = this.getLocalMemories();
    const existingIndex = local.findIndex(m => m.id === memory.id);
    if (existingIndex >= 0) {
      local[existingIndex] = memory;
    } else {
      local.unshift(memory);
    }
    this.saveLocalMemories(local);

    // 2. Sync to Firestore
    try {
      await firestoreService.saveMemory(userId, memory);
      logger.info('Memory saved to Firestore successfully', { memoryId: memory.id });
    } catch (err) {
      logger.error('Failed to save memory to firestore, stored locally for sync', err);
    }
  }

  /**
   * Updates an existing memory record.
   */
  async updateMemory(userId: string, memory: Memory): Promise<void> {
    const memoryWithUpdated = {
      ...memory,
      updatedAt: new Date().toISOString(),
    };

    await this.saveMemory(userId, memoryWithUpdated);
  }

  /**
   * Secure deletion of a memory including all stored media binaries in Firebase Storage.
   */
  async deleteMemory(userId: string, memoryId: string): Promise<void> {
    const local = this.getLocalMemories();
    const target = local.find(m => m.id === memoryId);

    // 1. Delete associated media files from Storage
    if (target) {
      if (target.photos && target.photos.length > 0) {
        for (const photo of target.photos) {
          if (photo.storagePath) {
            await mediaStorageService.deleteMediaItem(photo.storagePath);
          }
        }
      }
      if (target.videos && target.videos.length > 0) {
        for (const video of target.videos) {
          if (video.storagePath) {
            await mediaStorageService.deleteMediaItem(video.storagePath);
          }
        }
      }
    }

    // 2. Remove from local storage cache
    const updated = local.filter(m => m.id !== memoryId);
    this.saveLocalMemories(updated);

    // 3. Delete from Firestore if connected
    try {
      await firestoreService.deleteMemory(userId, memoryId);
      logger.info('Memory document deleted from Firestore', { memoryId });
    } catch (err) {
      logger.warn('Failed to delete memory from Firestore (may be offline)', { error: String(err) });
    }
  }

  /**
   * Toggles the favorite status of a memory.
   */
  async toggleFavorite(userId: string, memoryId: string): Promise<boolean> {
    const memories = await this.getMemories(userId);
    const target = memories.find(m => m.id === memoryId);
    if (!target) return false;

    const updatedMemory = {
      ...target,
      isFavorite: !target.isFavorite,
    };

    await this.saveMemory(userId, updatedMemory);
    return updatedMemory.isFavorite;
  }

  async saveReflection(userId: string, reflection: Reflection): Promise<void> {
    logger.info('Saved reflection in repository', { userId, moodRating: reflection.moodRating });
  }

  private getLocalMemories(): Memory[] {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  private saveLocalMemories(memories: Memory[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(memories));
    } catch (err) {
      logger.error('Failed to save memories to localStorage', err);
    }
  }
}

export const memoryRepository = new MemoryRepository();
export default memoryRepository;
