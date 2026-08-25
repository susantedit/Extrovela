/**
 * EXTROVELA — Onboarding Types and Schema (Phase 3)
 */

export type AdventureLevel = 'Comfort' | 'Stretch' | 'Adventure' | 'Wild Card';
export type SocialPreference = 'solo' | 'friends' | 'meet_people' | 'flexible';
export type EnergyLevel = 'Chill' | 'Moderate' | 'High Energy' | 'Flexible';

export interface OnboardingState {
  step: number;
  name: string;
  motivations: string[];
  adventureStyle: {
    adventure: 'comfortable' | 'stretch' | 'surprise';
    social: 'solo' | 'sometimes_social' | 'bring_people';
    environment: 'indoor' | 'outdoor' | 'mix';
  };
  adventureLevel: AdventureLevel;
  socialPreference: SocialPreference;
  interests: string[];
  dislikes: string[];
  typicalAvailableTime: string;
  budgetRange: string;
  energyPreference: EnergyLevel;
  locationPermissionStatus: 'granted' | 'denied' | 'prompt';
  notificationPermissionStatus: 'granted' | 'denied' | 'prompt';
  completed: boolean;
}

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  step: 1,
  name: '',
  motivations: [],
  adventureStyle: {
    adventure: 'stretch',
    social: 'solo',
    environment: 'mix',
  },
  adventureLevel: 'Stretch',
  socialPreference: 'solo',
  interests: [],
  dislikes: [],
  typicalAvailableTime: '1 hour',
  budgetRange: 'Under NPR 300',
  energyPreference: 'Chill',
  locationPermissionStatus: 'prompt',
  notificationPermissionStatus: 'prompt',
  completed: false,
};
