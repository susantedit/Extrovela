/**
 * EXTROVELA — Personalized Quest Engine Types (Phase 5 & 6)
 */

import { Coordinates } from '../../types/place';
import { Quest, QuestAttempt } from '../../types/quest';
import { UserPreferences, UserProfile } from '../../types/user';
// Type-only imports: these keep the quest-engine types decoupled from the service
// runtime (weather/places services pull in the provider client, feature flags,
// etc.), so a bare Node test bundle of the scorer/constraint engine stays clean.
import type { WeatherContextInfo } from '../../services/context/weatherService';
import type { PlaceWithContext } from '../../services/context/placesService';

export type TimeOfDay = 'earlyMorning' | 'morning' | 'afternoon' | 'evening' | 'night' | 'lateNight';

export interface TimeContext {
  localDate: string;
  localTime: string;
  dayOfWeek: string;
  timeOfDay: TimeOfDay;
  isWeekend: boolean;
  minutesUntilSunset?: number;
  minutesSinceSunset?: number;
  season: string;
}

export interface LocationContext {
  latitude: number;
  longitude: number;
  city: string;
  district?: string;
  country: string;
  source: 'gps' | 'preference' | 'default' | 'manual' | 'none';
  /**
   * False when no real location could be resolved (no GPS permission / no fix /
   * no manual city). Consumers MUST skip location-dependent enrichment (weather,
   * nearby places) rather than treat latitude/longitude as meaningful.
   */
  available?: boolean;
}

export interface QuestRequest {
  userId: string;
  availableTimeMinutes?: number;
  energy?: 'Chill' | 'Moderate' | 'High Energy' | 'Flexible';
  mood?: string;
  budgetMaxNpr?: number;
  socialPreference?: 'solo' | 'friends' | 'meet_people' | 'flexible';
  environmentPreference?: 'indoor' | 'outdoor' | 'mix';
  adventureLevel?: 'Comfort' | 'Stretch' | 'Adventure' | 'Wild Card';
  requestedCategory?: string;
  location?: Coordinates;
  requestedAt?: string;
  specialConstraints?: string[];
}

export interface EngineContext {
  user: UserProfile;
  preferences: UserPreferences;
  currentRequest: QuestRequest;
  time: TimeContext;
  location: LocationContext;
  weather?: WeatherContextInfo;
  /**
   * Collected in ContextBuilder but NOT consumed by candidate scoring/ranking
   * today, and currently populated with MOCK data (audit §8). Reserved for a
   * future real POI provider. Never render these as real place claims in quest
   * text — AI grounding requires quests to carry no unverified place names.
   */
  nearbyPlaces?: PlaceWithContext[];
  recentQuests: Quest[];
  completedExperiences: QuestAttempt[];
  recentCategories: string[];
}

export interface QuestCandidate extends Quest {
  rawScore?: number;
  fingerprint: string;
  /**
   * Optional real place this candidate is bound to. When present, the constraint
   * engine can reject it if the place is closed now. Dormant until a place-bound
   * candidate generator sets it (deferred follow-up).
   */
  boundPlace?: PlaceWithContext;
  scoreBreakdown?: {
    preferenceScore: number;
    contextScore: number;
    noveltyScore: number;
    diversityScore: number;
    repetitionPenalty: number;
    dislikePenalty: number;
    /** Weather-fit term. 0 (and byte-identical to legacy) whenever weather is absent. */
    weatherScore?: number;
    finalScore: number;
  };
}

export interface ConstraintValidationResult {
  valid: boolean;
  reasons: string[];
}

export interface QuestRejectionSignal {
  questId: string;
  userId: string;
  reason: 'too_expensive' | 'too_far' | 'not_my_thing' | 'too_social' | 'too_boring' | 'too_difficult' | 'bad_timing' | 'already_done_it' | 'not_feeling_it' | 'other';
  feedbackNotes?: string;
  timestamp: string;
}
