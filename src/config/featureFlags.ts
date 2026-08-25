/**
 * EXTROVELA — Feature Flags Configuration (Phases 6–12)
 *
 * Two independent gates, both of which must pass:
 *
 *   1. MASTER TOGGLE  — is this feature built and safe to run at all?
 *   2. ROLLOUT BUCKET — is this particular user in the enabled percentage?
 *
 * Bucketing is a stable hash of `userId + flagKey`. Two consequences that matter:
 *   - A user's bucket never changes between sessions, so nobody sees a feature
 *     flicker in and out.
 *   - The salt is the flag key, so a user unlucky enough to land in bucket 97 for
 *     one feature is not systematically excluded from every other feature.
 *
 * There is no network call. Rollout is evaluated locally and synchronously, so it
 * is safe to call during render and works offline.
 */

export type RolloutPercentage = 0 | 1 | 5 | 10 | 25 | 50 | 100;

export interface FeatureFlags {
  // ─── Phases 6–10 ───
  realLocation: boolean;
  realPlaces: boolean;
  realWeather: boolean;
  realRouting: boolean;
  realEvents: boolean;
  contextualQuestGeneration: boolean;
  mapExperience: boolean;
  smartNotifications: boolean;
  dailyQuestNotifications: boolean;
  weatherNotifications: boolean;
  questReminders: boolean;
  notificationInbox: boolean;
  smartReengagement: boolean;

  // ─── Phase 11: Experience Intelligence ───
  advancedPersonalization: boolean;
  experienceMemory: boolean;
  experienceGraph: boolean;
  reflectionInsights: boolean;
  aiMemoryRecall: boolean;
  surpriseQuest: boolean;
  adaptiveNovelty: boolean;
  personalizedQuestGeneration: boolean;

  // ─── Phase 12: Memory Journal 2.0 & Recaps ───
  memoryJournalV2: boolean;
  experienceTimeline: boolean;
  monthlyRecaps: boolean;
  yearlyRecaps: boolean;
  aiMemoryStories: boolean;
  shareableExperienceCards: boolean;
  memoryCollections: boolean;
  smartCollections: boolean;
  recapSharing: boolean;

  // ─── Phase 14: Social Experiences & Shared Quests ───
  socialConnections: boolean;
  questInvites: boolean;
  sharedQuests: boolean;
  socialGroups: boolean;
}

export type FeatureFlagKey = keyof FeatureFlags;

/**
 * Master toggles. `false` here means the feature does not run for anyone,
 * regardless of rollout percentage.
 */
export const featureFlags: FeatureFlags = {
  // Real-world PROVIDER gates (Phase 13). realWeather/realPlaces are now WIRED:
  // weatherService/placesService call the server provider client only when the
  // matching master toggle is on; off → they fail clean (null / empty), and NEVER
  // fall back to mock data in production. realRouting/realEvents stay off — routing
  // is not yet wired into candidate ranking and events has no keyless provider.
  // realLocation remains inert (no call site): device geolocation (Capacitor) and
  // the Leaflet/OSM map are always-on and are NOT gated by these flags.
  realLocation: false,
  realPlaces: true,
  realWeather: true,
  realRouting: false,
  realEvents: false,
  contextualQuestGeneration: true,
  mapExperience: true,
  smartNotifications: true,
  dailyQuestNotifications: true,
  weatherNotifications: true,
  questReminders: true,
  notificationInbox: true,
  smartReengagement: true,

  advancedPersonalization: true,
  experienceMemory: true,
  experienceGraph: true,
  reflectionInsights: true,
  aiMemoryRecall: true,
  surpriseQuest: true,
  adaptiveNovelty: true,
  personalizedQuestGeneration: true,

  memoryJournalV2: true,
  experienceTimeline: true,
  monthlyRecaps: true,
  yearlyRecaps: true,
  aiMemoryStories: true,
  shareableExperienceCards: true,
  memoryCollections: true,
  smartCollections: true,
  recapSharing: true,

  // Phase 14 — social experiences. Master toggles on; the layer degrades to
  // local-first / fail-clean when no Firebase project is configured (see
  // SocialRepository). Rollout is dialed conservatively below.
  socialConnections: true,
  questInvites: true,
  sharedQuests: true,
  socialGroups: true,
};

/**
 * Rollout percentages. Ship order for Phase 11/12 is deliberate:
 *
 *   Signal collection first (experienceMemory, experienceGraph at 100%) — the
 *   profile needs data before personalization can do anything useful, and
 *   collection is the lowest-risk part of the system.
 *
 *   Then ranking (advancedPersonalization, adaptiveNovelty at 50%) — changes what
 *   users see, but every candidate has already passed safety and constraints.
 *
 *   Then anything that spends money or writes prose (personalizedQuestGeneration,
 *   aiMemoryStories at 10%/5%) — these are the cost and hallucination surfaces.
 *
 *   Then anything that leaves the device (recapSharing, shareableExperienceCards
 *   at 5%/10%) — a share link is public and cannot be un-published.
 */
export const rolloutPercentages: Record<FeatureFlagKey, RolloutPercentage> = {
  realLocation: 100,
  realPlaces: 100,
  realWeather: 100,
  realRouting: 0,
  realEvents: 0,
  contextualQuestGeneration: 100,
  mapExperience: 100,
  smartNotifications: 100,
  dailyQuestNotifications: 100,
  weatherNotifications: 100,
  questReminders: 100,
  notificationInbox: 100,
  smartReengagement: 100,

  // Phase 11
  experienceMemory: 100,
  experienceGraph: 100,
  reflectionInsights: 100,
  advancedPersonalization: 50,
  adaptiveNovelty: 50,
  aiMemoryRecall: 25,
  surpriseQuest: 25,
  personalizedQuestGeneration: 10,

  // Phase 12
  memoryJournalV2: 100,
  experienceTimeline: 50,
  monthlyRecaps: 25,
  yearlyRecaps: 25,
  memoryCollections: 25,
  smartCollections: 10,
  shareableExperienceCards: 10,
  aiMemoryStories: 5,
  recapSharing: 5,

  // Phase 14 — connections first (the base relationship the rest builds on),
  // then invites/shared quests, then multi-party groups last (largest blast radius).
  socialConnections: 50,
  questInvites: 25,
  sharedQuests: 25,
  socialGroups: 10,
};

const OVERRIDE_STORAGE_KEY = 'extrovela_flag_overrides';

/**
 * FNV-1a. Chosen because it is short, has no dependencies, and gives an even
 * spread over 100 buckets for short strings — which is all that is required here.
 */
function hashToBucket(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash >>> 0) % 100;
}

/** Stable 0–99 bucket for one user and one flag. */
export function rolloutBucket(userId: string, key: FeatureFlagKey): number {
  return hashToBucket(`${key}:${userId}`);
}

function readOverrides(): Partial<Record<FeatureFlagKey, boolean>> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(OVERRIDE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<FeatureFlagKey, boolean>>) : {};
  } catch {
    return {};
  }
}

/**
 * QA / support override. Local to one device, and it CANNOT switch on a feature
 * whose master toggle is off — an override forces a rollout decision, never an
 * unbuilt feature.
 */
export function setFeatureOverride(key: FeatureFlagKey, value: boolean | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const overrides = readOverrides();
    if (value === null) delete overrides[key];
    else overrides[key] = value;
    localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* non-fatal: overrides are a convenience, not a requirement */
  }
}

export function clearFeatureOverrides(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(OVERRIDE_STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
}

/**
 * The single question every call site should ask.
 *
 * Omitting `userId` evaluates the master toggle only. That is correct for
 * app-level capabilities (realWeather) and wrong for anything user-scoped — a
 * percentage-gated flag with no userId returns false rather than silently
 * treating an anonymous session as enrolled.
 */
export function isFeatureEnabled(key: FeatureFlagKey, userId?: string | null): boolean {
  if (!featureFlags[key]) return false;

  const override = readOverrides()[key];
  if (typeof override === 'boolean') return override;

  const percentage = rolloutPercentages[key] ?? 0;
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;

  // Percentage-gated but no identity to bucket on: fail closed.
  if (!userId) return false;

  return rolloutBucket(userId, key) < percentage;
}

/** Resolves every flag at once — useful for a debug screen or a support dump. */
export function resolveAllFlags(userId?: string | null): Record<FeatureFlagKey, boolean> {
  const resolved = {} as Record<FeatureFlagKey, boolean>;
  (Object.keys(featureFlags) as FeatureFlagKey[]).forEach(key => {
    resolved[key] = isFeatureEnabled(key, userId);
  });
  return resolved;
}
