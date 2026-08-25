/**
 * EXTROVELA — Memory & Reflection Domain Contracts
 */

import { Coordinates } from './place';

export type MemoryVisibility = 'private' | 'shared';

export type MemoryMood =
  | 'happy'
  | 'calm'
  | 'energized'
  | 'inspired'
  | 'surprised'
  | 'connected'
  | 'peaceful'
  | 'neutral'
  | 'tired'
  | 'disappointed';

export interface LocationData extends Coordinates {
  city: string;
  neighborhood?: string;
  placeName?: string;
}

export interface MemoryLocation extends LocationData {
  placeId?: string;
  precision?: 'exact' | 'approximate';
}

export interface QuestFeedback {
  wouldDoAgain: 'absolutely' | 'maybe' | 'never';
  tags: string[]; // e.g. "Peaceful", "Scenic", "Too crowded", "Too expensive", "Too far", "Social", "Unexpected"
}

export interface Reflection {
  text: string;
  moodRating: number; // 1 to 5
  mood?: MemoryMood;
  voiceNoteDuration?: number;
  tags: string[];
}

export interface MemoryMedia {
  id: string;
  memoryId: string;
  userId: string;
  type: 'photo' | 'video';
  storagePath: string;
  downloadUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number; // for videos in seconds
  size: number; // bytes
  createdAt: string;
  status: 'queued' | 'uploading' | 'processing' | 'uploaded' | 'failed' | 'deleted';
}

export interface FirstTimeFlags {
  newPlace: boolean;
  newCategory: boolean;
  newExperienceType: boolean;
}

export interface Memory {
  id: string;
  userId: string;
  questId: string;
  questTitle: string;
  title?: string;
  description?: string;
  reflectionText: string;
  rating: number; // 1 to 5
  moodRating: number; // fallback alias for 1 to 5 rating
  mood?: MemoryMood;
  photos?: MemoryMedia[];
  videos?: MemoryMedia[];
  photoUrl?: string;
  voiceNoteDuration?: number;
  audioUrl?: string;
  location: MemoryLocation;
  category?: string;
  startedAt?: string;
  completedAt: string;
  createdAt: string;
  updatedAt?: string;
  visibility: MemoryVisibility;
  isFavorite: boolean;
  isFirstTimeExperience: boolean;
  firstTimeFlags?: FirstTimeFlags;
  feedback?: QuestFeedback;
  tags: string[];
}

export interface ExperienceStats {
  period: string; // e.g. "total", "2026-08"
  totalExperiences: number;
  newPlaces: number;
  firstTimeExperiences: number;
  soloExperiences: number;
  socialExperiences: number;
  indoorExperiences: number;
  outdoorExperiences: number;
  favoriteExperiences: number;
  updatedAt: string;
}

