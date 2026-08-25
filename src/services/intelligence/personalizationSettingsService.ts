/**
 * EXTROVELA — Phase 11: Personalization Settings Service
 *
 * The user's control surface over everything the AI learns. Every derived-data
 * read and write in Phase 11 consults this service first.
 *
 * Controls implemented here:
 *  - disable AI personalization entirely (master switch)
 *  - disable long-term experience memory
 *  - disable "because you…" recall strings
 *  - disable surprise quests
 *  - tune novelty appetite
 *  - reset personalization (delete all DERIVED data, keep raw history)
 *  - delete everything EXTROVELA has learned (derived AND raw events)
 */

import logger from '../../utils/logger';
import { intelligenceFirestore } from './intelligenceFirestore';
import {
  DEFAULT_PERSONALIZATION_SETTINGS,
  type PersonalizationSettings,
} from '../../types/experienceIntelligence';

/** In-memory cache so the hot path never awaits a network round trip. */
const cache = new Map<string, PersonalizationSettings>();

export class PersonalizationSettingsService {
  async getSettings(userId: string): Promise<PersonalizationSettings> {
    if (!userId) {
      return { userId: '', ...DEFAULT_PERSONALIZATION_SETTINGS, updatedAt: new Date().toISOString() };
    }

    const cached = cache.get(userId);
    if (cached) return cached;

    const stored = await intelligenceFirestore.getSettings(userId);
    const resolved: PersonalizationSettings = stored
      ? { ...DEFAULT_PERSONALIZATION_SETTINGS, ...stored, userId }
      : { userId, ...DEFAULT_PERSONALIZATION_SETTINGS, updatedAt: new Date().toISOString() };

    cache.set(userId, resolved);
    return resolved;
  }

  /** Synchronous read of the cached value. Returns defaults when not yet loaded. */
  getCachedSettings(userId: string): PersonalizationSettings {
    return (
      cache.get(userId) || {
        userId,
        ...DEFAULT_PERSONALIZATION_SETTINGS,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  async updateSettings(
    userId: string,
    patch: Partial<Omit<PersonalizationSettings, 'userId' | 'updatedAt'>>
  ): Promise<PersonalizationSettings> {
    const current = await this.getSettings(userId);
    const next: PersonalizationSettings = {
      ...current,
      ...patch,
      noveltyPreference:
        patch.noveltyPreference !== undefined
          ? Math.min(1, Math.max(0, patch.noveltyPreference))
          : current.noveltyPreference,
      userId,
      updatedAt: new Date().toISOString(),
    };

    cache.set(userId, next);
    await intelligenceFirestore.saveSettings(next);
    logger.info('Personalization settings updated', {
      aiPersonalizationEnabled: next.aiPersonalizationEnabled,
      experienceMemoryEnabled: next.experienceMemoryEnabled,
    });
    return next;
  }

  /**
   * Resets personalization: deletes every DERIVED artefact but keeps the raw
   * event log so the user can rebuild later if they change their mind.
   */
  async resetPersonalization(userId: string): Promise<{ deleted: number; remote: boolean }> {
    const result = await intelligenceFirestore.deleteAllDerived(userId);
    logger.info('Personalization reset: derived data cleared', {
      deleted: result.deleted,
      remoteCleared: result.remote,
    });
    return result;
  }

  /**
   * Deletes everything the app has learned, raw events included. This is the
   * "forget me" control and is irreversible.
   */
  async deleteAllLearnedData(userId: string): Promise<{ deleted: number; remote: boolean }> {
    const result = await intelligenceFirestore.deleteAllIncludingRaw(userId);
    logger.info('All learned personalization data deleted', {
      deleted: result.deleted,
      remoteCleared: result.remote,
    });
    return result;
  }

  /** Drops the cache — used on sign-out so User A's settings never serve User B. */
  clearCache(userId?: string): void {
    if (userId) cache.delete(userId);
    else cache.clear();
  }
}

export const personalizationSettingsService = new PersonalizationSettingsService();
export default personalizationSettingsService;
