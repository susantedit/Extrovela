import { ExplorationRecord } from '../types/place';
import { MOCK_USER_STATS } from '../constants/mockData';
import { UserStats } from '../types/recap';
import logger from '../utils/logger';

export class ExplorationRepository {
  async getUserExplorationStats(userId: string): Promise<UserStats> {
    logger.info('Fetching exploration stats from repository', { userId });
    return MOCK_USER_STATS;
  }

  async recordExploration(record: ExplorationRecord): Promise<void> {
    logger.info('Recorded new place exploration', { placeId: record.placeId });
  }
}

export const explorationRepository = new ExplorationRepository();
