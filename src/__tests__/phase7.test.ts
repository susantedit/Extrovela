/**
 * EXTROVELA — Phase 7 Automated Test Suite
 * 
 * Tests:
 * 1. Quest State Machine valid & invalid transitions
 * 2. Quest Session creation
 * 3. Sync Service idempotency key deduplication
 * 4. Experience Statistics calculations
 * 5. Media Processor file validation
 */

import { QuestStateMachine, QuestSession } from '../features/quest-execution/questStateMachine';
import { QuestSyncService } from '../services/sync/questSyncService';
import { ExperienceStatsService } from '../services/memories/experienceStatsService';
import { MediaProcessor } from '../features/memories/mediaProcessor';
import { Memory } from '../types/memory';

// Mock localStorage for node environment test execution
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof window === 'undefined') {
  (global as any).localStorage = localStorageMock;
}

export function runPhase7Tests() {
  const results: { test: string; passed: boolean; error?: string }[] = [];

  const assert = (condition: boolean, testName: string) => {
    if (!condition) {
      results.push({ test: testName, passed: false, error: 'Assertion failed' });
      throw new Error(`TEST FAILED: ${testName}`);
    }
    results.push({ test: testName, passed: true });
  };

  // 1. State Machine: Allowed Transitions
  try {
    let session = QuestStateMachine.createSession({
      userId: 'test_user',
      questId: 'quest_1',
      questTitle: 'Sunset Walk',
    });

    session = QuestStateMachine.transition(session, 'viewed');
    assert(session.status === 'viewed', 'State Machine transition generated -> viewed');

    session = QuestStateMachine.transition(session, 'accepted');
    assert(session.status === 'accepted', 'State Machine transition viewed -> accepted');

    session = QuestStateMachine.transition(session, 'started');
    assert(session.status === 'started', 'State Machine transition accepted -> started');

    session = QuestStateMachine.transition(session, 'inProgress');
    assert(session.status === 'inProgress', 'State Machine transition started -> inProgress');

    session = QuestStateMachine.transition(session, 'paused');
    assert(session.status === 'paused', 'State Machine transition inProgress -> paused');

    session = QuestStateMachine.transition(session, 'inProgress');
    assert(session.status === 'inProgress', 'State Machine transition paused -> inProgress');

    session = QuestStateMachine.transition(session, 'completed');
    assert(session.status === 'completed', 'State Machine transition inProgress -> completed');
  } catch (err: any) {
    results.push({ test: 'State Machine Valid Transitions', passed: false, error: err.message });
  }

  // 2. State Machine: Invalid Transition Prevention
  try {
    const session = QuestStateMachine.createSession({
      userId: 'test_user',
      questId: 'quest_1',
      questTitle: 'Sunset Walk',
    });

    let threw = false;
    try {
      QuestStateMachine.transition(session, 'completed');
    } catch {
      threw = true;
    }
    assert(threw, 'State Machine prevents direct generated -> completed transition');

    threw = false;
    const completedSession: QuestSession = { ...session, status: 'completed' };
    try {
      QuestStateMachine.transition(completedSession, 'started');
    } catch {
      threw = true;
    }
    assert(threw, 'State Machine prevents terminal completed -> started transition');
  } catch (err: any) {
    results.push({ test: 'State Machine Invalid Transitions', passed: false, error: err.message });
  }

  // 3. Sync Service Deduplication / Idempotency
  try {
    localStorage.clear();
    const syncService = new QuestSyncService();

    syncService.enqueue({
      idempotencyKey: 'idemp_key_100',
      type: 'memory_creation',
      userId: 'test_user',
      payload: { id: 'mem_1', title: 'Test Memory' },
    });

    // Enqueue duplicate key
    syncService.enqueue({
      idempotencyKey: 'idemp_key_100',
      type: 'memory_creation',
      userId: 'test_user',
      payload: { id: 'mem_1', title: 'Test Memory Duplicate' },
    });

    const queue: any[] = JSON.parse(localStorage.getItem('extrovela_sync_queue') || '[]');
    assert(queue.length === 1, 'Sync Service deduplicates items with duplicate idempotencyKey');
  } catch (err: any) {
    results.push({ test: 'Sync Service Idempotency', passed: false, error: err.message });
  }

  // 4. Experience Statistics Calculation
  try {
    const testMemories: Memory[] = [
      {
        id: 'm1',
        userId: 'u1',
        questId: 'q1',
        questTitle: 'Tea Session',
        completedAt: '2026-08-01T10:00:00Z',
        createdAt: '2026-08-01T10:00:00Z',
        rating: 5,
        moodRating: 5,
        reflectionText: 'Quiet tea',
        location: { city: 'Kathmandu', lat: 27.7, lng: 85.3 },
        visibility: 'private',
        isFavorite: true,
        isFirstTimeExperience: true,
        firstTimeFlags: { newPlace: true, newCategory: true, newExperienceType: true },
        tags: ['solo', 'teahouse'],
      },
      {
        id: 'm2',
        userId: 'u1',
        questId: 'q2',
        questTitle: 'Sunset Walk',
        completedAt: '2026-08-15T18:00:00Z',
        createdAt: '2026-08-15T18:00:00Z',
        rating: 4,
        moodRating: 4,
        reflectionText: 'Orange clouds',
        location: { city: 'Kathmandu', lat: 27.7, lng: 85.3 },
        visibility: 'private',
        isFavorite: false,
        isFirstTimeExperience: false,
        tags: ['outdoor', 'scenic'],
      },
    ];

    const stats = ExperienceStatsService.computeStats(testMemories);
    assert(stats.totalExperiences === 2, 'Experience Stats calculates total count');
    assert(stats.favoriteExperiences === 1, 'Experience Stats calculates favorites count');
    assert(stats.firstTimeCount === 1, 'Experience Stats calculates first-time count');
  } catch (err: any) {
    results.push({ test: 'Experience Statistics Calculation', passed: false, error: err.message });
  }

  // 5. Media Processor Validation Rules
  try {
    const dummyImageFile = new File(['fake image bytes'], 'test.jpg', { type: 'image/jpeg' });
    const imgValidation = MediaProcessor.validateFile(dummyImageFile);
    assert(imgValidation.isValid === true, 'MediaProcessor accepts valid image file');

    const dummyExeFile = new File(['fake bytes'], 'test.exe', { type: 'application/x-msdownload' });
    const exeValidation = MediaProcessor.validateFile(dummyExeFile);
    assert(exeValidation.isValid === false, 'MediaProcessor rejects non-media file');
  } catch (err: any) {
    results.push({ test: 'Media Processor Validation', passed: false, error: err.message });
  }

  return results;
}

// Auto-run if executed directly
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  console.log('Running Phase 7 automated tests...');
  const res = runPhase7Tests();
  console.log('Test Results:', JSON.stringify(res, null, 2));
}
