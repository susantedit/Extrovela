import { Quest, QuestAttempt } from '../types/quest';
import { MOCK_TODAY_QUEST, MOCK_QUICK_ESCAPES } from '../constants/mockData';
import logger from '../utils/logger';

export class QuestRepository {
  async getTodayFeaturedQuest(userId: string): Promise<Quest> {
    logger.info('Fetching today quest from repository', { userId });
    return MOCK_TODAY_QUEST;
  }

  async getCuratedQuests(category?: string): Promise<Quest[]> {
    if (!category || category === 'all') return MOCK_QUICK_ESCAPES;
    return MOCK_QUICK_ESCAPES.filter(q => q.category.toLowerCase().includes(category.toLowerCase()));
  }

  async saveQuestAttempt(attempt: QuestAttempt): Promise<void> {
    logger.info('Saving quest attempt in repository', { attemptId: attempt.id, status: attempt.status });
    const saved = localStorage.getItem('extrovela_quest_attempts') || '[]';
    const list = JSON.parse(saved);
    list.unshift(attempt);
    localStorage.setItem('extrovela_quest_attempts', JSON.stringify(list));
  }
}

export const questRepository = new QuestRepository();
