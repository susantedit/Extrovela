/**
 * EXTROVELA — User & Preferences Domain Contracts (Phase 5)
 */

export type AdventureLevel = 'Comfort' | 'Stretch' | 'Adventure' | 'Wild Card';
export type SocialPreference = 'Solo' | 'Low-pressure social' | 'With a friend' | 'Group adventure';
export type EnvironmentPreference = 'Outdoor' | 'Indoor' | 'Urban Street' | 'Nature' | 'Cozy Local Spot';
export type BudgetRange = 'Free' | 'Low ($)' | 'Moderate ($$)' | 'Treat Myself ($$$)';
export type TimeOption = '15 mins' | '30 mins' | '1 hour' | '2+ hours' | 'Full day';

export interface UserPersonality {
  adventurousVsComfort: number; // 0 to 100
  soloVsSocial: number;         // 0 to 100
  spontaneousVsPlanned: number; // 0 to 100
  calmVsEnergetic: number;      // 0 to 100
}

export interface UserPrivacySettings {
  allowAnalytics?: boolean;
  hideExactHomeArea?: boolean;
  enableCrashReporting?: boolean;
}

export interface UserPreferences {
  goals: string[];
  personality: UserPersonality;
  hasCompletedOnboarding: boolean;
  interests?: string[];
  dislikes?: string[];
  preferredCategories?: string[];
  dislikedCrowds?: boolean;
  socialPreference?: SocialPreference;
  environmentPreference?: EnvironmentPreference;
  adventureLevel?: AdventureLevel;
  budgetPreference?: BudgetRange;
  typicalAvailableTime?: TimeOption;
  privacy?: UserPrivacySettings;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  city: string;
  joinedAt: string;
  updatedAt: string;
  preferences: UserPreferences;
}
