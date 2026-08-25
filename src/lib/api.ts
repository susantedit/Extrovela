// EXTROVELA — Offline-First MongoDB Client API Service
// Seamlessly syncs user experiences with MongoDB backend while guaranteeing 100% offline functionality.

import { Memory, Quest, UserStats } from '../types';
import localQuestData from '../../context/quest_database.json';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`;
const OFFLINE_QUEUE_KEY = 'extrovela_offline_sync_queue';

// ─── 1. Offline Queue Helpers ──────────────────────────────
export function getOfflineQueue(): Memory[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToOfflineQueue(memory: Memory): void {
  try {
    const queue = getOfflineQueue();
    queue.push(memory);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Error queueing offline memory:', e);
  }
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

// ─── 2. Sync Offline Memories to MongoDB ──────────────────
export async function syncOfflineMemories(): Promise<number> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  try {
    const res = await fetch(`${API_BASE_URL}/memories/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memories: queue }),
    });

    if (res.ok) {
      clearOfflineQueue();
      console.log(`[EXTROVELA Sync] Synced ${queue.length} offline memories to MongoDB.`);
      return queue.length;
    }
  } catch (e) {
    console.warn('[EXTROVELA Sync] MongoDB offline or unreachable. Memories remain cached locally.');
  }
  return 0;
}

// ─── 3. Quests API ─────────────────────────────────────────
export async function fetchQuestsFromAPI(params?: {
  time?: string;
  energy?: string;
  mood?: string;
  budget?: string;
  social?: string;
  environment?: string;
  season?: string;
}): Promise<Quest[]> {
  try {
    const searchParams = new URLSearchParams(params as Record<string, string> || {});
    const res = await fetch(`${API_BASE_URL}/quests?${searchParams.toString()}`, {
      signal: AbortSignal.timeout(3000), // 3s timeout for instant offline fallback
    });

    if (res.ok) {
      const data = await res.json();
      if (data.quests && data.quests.length > 0) {
        return data.quests;
      }
    }
  } catch {
    // Graceful offline fallback
  }

  // Return local curated quest database
  return localQuestData.quests as Quest[];
}

// ─── 4. Save Memory API ───────────────────────────────────
export async function saveMemoryToAPI(memory: Memory): Promise<{ success: boolean; memory: Memory }> {
  try {
    const res = await fetch(`${API_BASE_URL}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memory),
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, memory: data.memory || memory };
    }
  } catch (error) {
    console.warn('[EXTROVELA API] MongoDB offline. Memory safely preserved in local offline storage.');
  }

  // Queue for next sync attempt
  addToOfflineQueue(memory);
  return { success: true, memory };
}

// ─── 5. Fetch Memories API ────────────────────────────────
export async function fetchMemoriesFromAPI(userId: string = 'anonymous_user'): Promise<Memory[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/memories?userId=${encodeURIComponent(userId)}`, {
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      return data.memories || [];
    }
  } catch {
    // Offline
  }
  return null;
}

// ─── 6. Fetch Stats API ───────────────────────────────────
export async function fetchStatsFromAPI(userId: string = 'anonymous_user'): Promise<UserStats | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/stats?userId=${encodeURIComponent(userId)}`, {
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      return data.stats || null;
    }
  } catch {
    // Offline
  }
  return null;
}
