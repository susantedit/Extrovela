/**
 * EXTROVELA — Quest Domain Contracts
 */

import { AdventureLevel, BudgetRange, EnvironmentPreference, SocialPreference, TimeOption } from './user';

export type Mood = 'Reflective' | 'Curious' | 'Playful' | 'Social' | 'Peaceful' | 'Spontaneous';
export type Energy = 'Chill' | 'Moderate' | 'High Energy' | 'Adventurous';
export type Season = 'Garimahina (Summer)' | 'Jadamahina (Winter)' | 'Any';

export interface QuestStep {
  stepNumber: number;
  title: string;
  description: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  category: string;
  environment: EnvironmentPreference;
  mood: Mood;
  energy: Energy;
  time: TimeOption;
  budget: BudgetRange;
  social: SocialPreference;
  season: Season;
  difficulty?: AdventureLevel;
  cityContext?: string[];
  starterQuest?: boolean;
  whyThisQuest?: string;
  isQuestChain?: boolean;
  chainSteps?: QuestStep[];
  safetyNotes?: string[];
  tags: string[];
  createdAt?: string;
}

export type QuestStatus =
  | 'generated'
  | 'viewed'
  | 'accepted'
  | 'started'
  | 'inProgress'
  | 'paused'
  | 'completed'
  | 'skipped'
  | 'abandoned'
  | 'expired';

export type SkipReason =
  | 'too_far'
  | 'too_expensive'
  | 'not_feeling_it'
  | 'already_done'
  | 'not_interested'
  | 'bad_timing'
  | 'other';

export interface QuestStep {
  stepNumber: number;
  title: string;
  description: string;
  completed?: boolean;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  category: string;
  environment: EnvironmentPreference;
  mood: Mood;
  energy: Energy;
  time: TimeOption;
  budget: BudgetRange;
  social: SocialPreference;
  season: Season;
  difficulty?: AdventureLevel;
  cityContext?: string[];
  starterQuest?: boolean;
  whyThisQuest?: string;
  isQuestChain?: boolean;
  chainSteps?: QuestStep[];
  safetyNotes?: string[];
  tags: string[];
  createdAt?: string;
}

export interface QuestAttempt {
  id: string;
  questId: string;
  userId: string;
  status: QuestStatus;
  startedAt: string;
  completedAt?: string;
  isPhoneFreeMode: boolean;
  timeSpentMinutes?: number;
}

export interface QuestSession {
  id: string;
  userId: string;
  questId: string;
  questTitle: string;
  status: QuestStatus;
  startedAt: string;
  pausedAt?: string;
  completedAt?: string;
  durationSeconds: number;
  elapsedSeconds: number;
  totalDurationMinutes: number;
  isPhoneFreeMode: boolean;
  currentStepIndex: number;
  completionSource?: 'manual' | 'auto_timer' | 'location_arrival';
  skipReason?: SkipReason;
  skipNote?: string;
  abandonNote?: string;
  createdAt: string;
  updatedAt: string;
}

