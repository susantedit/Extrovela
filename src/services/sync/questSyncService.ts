/**
 * EXTROVELA — Quest Sync Service (Phase 7)
 * 
 * Handles offline quest completion queueing, idempotency deduplication, and Firestore synchronization.
 */

import { firestoreService } from '../firebase/firestore';
import { analytics } from '../firebase/firebaseAnalytics';
import logger from '../../utils/logger';

export interface PendingSyncItem {
  idempotencyKey: string;
  type: 'quest_completion' | 'memory_creation' | 'quest_session_update' | 'memory_deletion';
  userId: string;
  payload: any;
  queuedAt: string;
  retryCount: number;
}

export class QuestSyncService {
  private QUEUE_KEY = 'extrovela_sync_queue';
  private PROCESSED_KEYS_KEY = 'extrovela_processed_sync_keys';

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        logger.info('Network connection restored. Syncing pending offline items...');
        this.processQueue();
      });
    }
  }

  enqueue(item: Omit<PendingSyncItem, 'queuedAt' | 'retryCount'>): void {
    const processedKeys = this.getProcessedKeys();
    if (processedKeys.includes(item.idempotencyKey)) {
      logger.info('Duplicate idempotency key ignored', { key: item.idempotencyKey });
      return;
    }

    const queue: PendingSyncItem[] = this.getQueue();
    // Prevent duplicate queuing of same key
    if (queue.some(q => q.idempotencyKey === item.idempotencyKey)) {
      return;
    }

    const newItem: PendingSyncItem = {
      ...item,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
    };

    queue.push(newItem);
    this.saveQueue(queue);
    this.processQueue();
  }

  async processQueue(): Promise<void> {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    logger.info(`Processing ${queue.length} pending offline sync items...`);
    const remaining: PendingSyncItem[] = [];
    const processed = this.getProcessedKeys();

    for (const item of queue) {
      try {
        if (item.type === 'memory_creation') {
          await firestoreService.saveMemory(item.userId, item.payload);
          analytics.trackEvent('memory_created', { category: item.payload.category || 'general' });
        } else if (item.type === 'quest_session_update' || item.type === 'quest_completion') {
          await firestoreService.saveQuestSession(item.userId, item.payload);
          analytics.trackEvent('quest_completed', { quest_id: item.payload.questId });
        } else if (item.type === 'memory_deletion') {
          await firestoreService.deleteMemory(item.userId, item.payload.memoryId);
          analytics.trackEvent('memory_deleted', { memory_id: item.payload.memoryId });
        }

        processed.push(item.idempotencyKey);
      } catch (err) {
        logger.error('Failed to sync item; keeping in queue for retry', { key: item.idempotencyKey, error: String(err) });
        item.retryCount += 1;
        if (item.retryCount < 5) {
          remaining.push(item);
        }
      }
    }

    this.saveProcessedKeys(processed.slice(-200)); // keep last 200 keys
    this.saveQueue(remaining);
  }

  private getQueue(): PendingSyncItem[] {
    try {
      return JSON.parse(localStorage.getItem(this.QUEUE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  private saveQueue(queue: PendingSyncItem[]): void {
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
  }

  private getProcessedKeys(): string[] {
    try {
      return JSON.parse(localStorage.getItem(this.PROCESSED_KEYS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  private saveProcessedKeys(keys: string[]): void {
    localStorage.setItem(this.PROCESSED_KEYS_KEY, JSON.stringify(keys));
  }
}

export const questSyncService = new QuestSyncService();
export default questSyncService;

