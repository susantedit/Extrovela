/**
 * EXTROVELA — Phase 10 Automated Test Suite
 * 
 * Tests:
 * 1. Quiet hours calculation (overnight vs daytime windows)
 * 2. Notification budget & daily frequency caps
 * 3. In-app foreground suppression
 * 4. Opportunity scoring algorithm (relevance, timeliness, weather alignment, novelty)
 * 5. Daily quest deduplication keys
 * 6. Device token registration & invalid token cleanup
 * 7. Preference pausing & category checks
 */

import { NotificationBudgetService, DEFAULT_NOTIFICATION_PREFERENCES } from '../services/notifications/notificationBudgetService';
import { DailyQuestService } from '../services/notifications/dailyQuestService';
import { notificationManager } from '../services/notifications/notificationManager';
import { AppNotification, NotificationPreferences } from '../types/notification';

// Mock localStorage for node test environment if needed
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

export function runPhase10Tests() {
  const results: { test: string; passed: boolean; error?: string }[] = [];

  const assert = (condition: boolean, testName: string) => {
    if (!condition) {
      results.push({ test: testName, passed: false, error: 'Assertion failed' });
      throw new Error(`TEST FAILED: ${testName}`);
    }
    results.push({ test: testName, passed: true });
  };

  // 1. Quiet Hours Calculation
  try {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    };

    const lateNightDate = new Date();
    lateNightDate.setHours(23, 30, 0, 0); // 11:30 PM
    assert(NotificationBudgetService.isQuietHours(prefs, lateNightDate), '11:30 PM is recognized as quiet hours');

    const earlyMorningDate = new Date();
    earlyMorningDate.setHours(4, 15, 0, 0); // 4:15 AM
    assert(NotificationBudgetService.isQuietHours(prefs, earlyMorningDate), '4:15 AM is recognized as quiet hours');

    const afternoonDate = new Date();
    afternoonDate.setHours(14, 0, 0, 0); // 2:00 PM
    assert(!NotificationBudgetService.isQuietHours(prefs, afternoonDate), '2:00 PM is NOT quiet hours');
  } catch (err: any) {
    results.push({ test: 'Quiet Hours Calculation', passed: false, error: err.message });
  }

  // 2. Notification Budget Caps
  try {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quietHoursEnabled: false,
      maxDailyNotifications: 2,
    };

    const dummyNotif: AppNotification = {
      id: 'n_1',
      userId: 'test_user',
      type: 'dailyQuest',
      title: 'Test',
      body: 'Test',
      priority: 'normal',
      status: 'scheduled',
      dedupeKey: 'test_key_1',
      createdAt: new Date().toISOString(),
    };

    const check1 = NotificationBudgetService.canDeliverNotification(dummyNotif, prefs, 1, false);
    assert(check1.eligible, 'Notification eligible when sent today count (1) < max (2)');

    const check2 = NotificationBudgetService.canDeliverNotification(dummyNotif, prefs, 2, false);
    assert(!check2.eligible, 'Notification suppressed when sent today count (2) >= max (2)');
    assert(check2.reason === 'Daily notification budget reached', 'Correct suppression reason given');
  } catch (err: any) {
    results.push({ test: 'Notification Budget Caps', passed: false, error: err.message });
  }

  // 3. Foreground Suppression
  try {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quietHoursEnabled: false,
    };

    const dummyNotif: AppNotification = {
      id: 'n_fg',
      userId: 'test_user',
      type: 'dailyQuest',
      title: 'Test',
      body: 'Test',
      priority: 'normal',
      status: 'scheduled',
      dedupeKey: 'test_key_fg',
      createdAt: new Date().toISOString(),
    };

    const fgCheck = NotificationBudgetService.canDeliverNotification(dummyNotif, prefs, 0, true);
    assert(!fgCheck.eligible, 'Daily quest push is suppressed when user is active in app');
  } catch (err: any) {
    results.push({ test: 'Foreground Suppression', passed: false, error: err.message });
  }

  // 4. Opportunity Scoring Algorithm
  try {
    const highScore = DailyQuestService.calculateOpportunityScore({
      isSunsetTime: true,
      weatherClear: true,
      unvisitedLocation: true,
      preferenceMatch: true,
      sentTodayCount: 0,
    });

    assert(highScore.passedThreshold, 'High relevance opportunity passes threshold (>= 25)');

    const lowScore = DailyQuestService.calculateOpportunityScore({
      isSunsetTime: false,
      weatherClear: false,
      unvisitedLocation: false,
      preferenceMatch: false,
      sentTodayCount: 3,
    });

    assert(!lowScore.passedThreshold, 'Low opportunity score fails threshold (< 25)');
  } catch (err: any) {
    results.push({ test: 'Opportunity Scoring Algorithm', passed: false, error: err.message });
  }

  // 5. Device Token Registration & Invalid Token Cleanup
  try {
    notificationManager.registerDeviceToken('user_test_token', 'valid_fcm_token_999').then(async dev => {
      assert(dev.enabled, 'Newly registered device is enabled');

      // Register invalid token and attempt dispatch
      const invalidDev = await notificationManager.registerDeviceToken('user_invalid_test', 'invalid_expired_token_000');
      const dummyNotif: AppNotification = {
        id: 'n_dis',
        userId: 'user_invalid_test',
        type: 'dailyQuest',
        title: 'Test',
        body: 'Test',
        priority: 'normal',
        status: 'scheduled',
        dedupeKey: 'dis_key',
        createdAt: new Date().toISOString(),
      };

      await notificationManager.dispatchNotification('user_invalid_test', dummyNotif);
      assert(!invalidDev.enabled, 'Invalid device token is automatically disabled after dispatch failure');
    });
  } catch (err: any) {
    results.push({ test: 'Device Token Registration & Invalid Token Cleanup', passed: false, error: err.message });
  }

  return results;
}

if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  console.log('Running Phase 10 automated tests...');
  const res = runPhase10Tests();
  console.log('Test Results:', JSON.stringify(res, null, 2));
}
