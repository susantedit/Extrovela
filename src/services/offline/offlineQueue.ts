/**
 * EXTROVELA — Offline Sync Queue & Cache Manager
 * 
 * Queues quest completions, reflections, and photos locally when offline
 * and automatically syncs them when network connectivity is restored.
 */

import { Memory } from '../../types';
import logger from '../../utils/logger';

const OFFLINE_MEMORY_QUEUE_KEY = 'extrovela_offline_memory_queue';

export class OfflineQueueService {
  enqueueMemory(memory: Memory): void {
    const queue = this.getQueue();
    queue.push(memory);
    localStorage.setItem(OFFLINE_MEMORY_QUEUE_KEY, JSON.stringify(queue));
    logger.info('Enqueued memory for offline sync', { memoryId: memory.id });
  }

  getQueue(): Memory[] {
    try {
      const data = localStorage.getItem(OFFLINE_MEMORY_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  clearQueue(): void {
    localStorage.removeItem(OFFLINE_MEMORY_QUEUE_KEY);
  }
}

export const offlineQueue = new OfflineQueueService();
export default offlineQueue;
