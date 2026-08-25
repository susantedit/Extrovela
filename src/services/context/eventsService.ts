/**
 * EXTROVELA — Events Provider Service (Phase 6)
 * 
 * Abstract event provider gated behind feature flags.
 */

import { Coordinates } from '../../types/place';
import { LocalEvent } from '../providers/interfaces';
import { isFeatureEnabled } from '../../config/featureFlags';
import logger from '../../utils/logger';

export class EventsService {
  async getNearbyEvents(coords: Coordinates): Promise<LocalEvent[]> {
    if (!isFeatureEnabled('realEvents')) {
      logger.info('Events feature is currently gated behind feature flag; returning empty');
      return [];
    }

    return [
      {
        id: 'event_street_acoustic',
        title: 'Courtyard Sunset Acoustic Session',
        category: 'Live Music',
        startTime: '18:00',
        venueName: 'Patan Courtyard',
        coords,
      },
    ];
  }
}

export const eventsService = new EventsService();
export default eventsService;
