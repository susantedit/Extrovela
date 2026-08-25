/**
 * EXTROVELA — Quest Engine Client Service (Phase 5)
 * 
 * Provides typed methods for the UI to request, regenerate, and provide feedback on quests.
 */

import { questEngine } from '../quest-engine/QuestEngine';
import { QuestRequest, QuestRejectionSignal } from '../quest-engine/types';
import { LearningSystem } from '../quest-engine/feedback/LearningSystem';
import { experienceIntelligenceService } from './intelligence/experienceIntelligenceService';
import { Quest } from '../types/quest';
import { UserProfile, UserPreferences } from '../types/user';
import { analytics } from './firebase/firebaseAnalytics';

export class QuestEngineService {
  async generatePersonalizedQuest(params: {
    user: UserProfile;
    preferences: UserPreferences;
    request?: Partial<QuestRequest>;
  }): Promise<Quest> {
    analytics.trackEvent('quest_generated', { category: params.request?.requestedCategory || 'personalized' });

    const fullRequest: QuestRequest = {
      userId: params.user.id,
      ...params.request,
    };

    return await questEngine.generateQuest({
      user: params.user,
      preferences: params.preferences,
      request: fullRequest,
    });
  }

  recordRejection(signal: QuestRejectionSignal, category?: string): void {
    analytics.trackEvent('quest_abandoned', { quest_id: signal.questId });

    // Existing Phase 5 in-memory learning (unchanged).
    LearningSystem.recordRejectionSignal(signal);

    // Phase 11 — bridge the same rejection into the durable Experience
    // Intelligence event log so it becomes a negative preference signal.
    // Skipped for the local mock user so we never attempt a denied Firestore
    // write. Fire-and-forget: rejection learning must never surface an error.
    if (signal.userId && signal.userId !== 'user_active') {
      void experienceIntelligenceService.recordRejection(signal, category).catch(() => {});
    }
  }
}

export const questEngineService = new QuestEngineService();
export default questEngineService;
