/**
 * EXTROVELA — Exploration Map & Discovery Domain Contracts (Phase 8)
 */

import { Coordinates } from '../../types/place';

export type ExplorationCellLevel = 'city' | 'district' | 'neighborhood' | 'micro';

export interface ExplorationCell {
  id: string;
  userId: string;
  cellCode: string; // e.g. "cell_27.71_85.32" (~500m grid cell)
  center: Coordinates;
  experienceCount: number;
  memoryCount: number;
  firstExploredAt: string;
  lastExploredAt: string;
  categories: string[];
}

export interface ExplorationRecord {
  id: string;
  userId: string;
  placeId?: string;
  memoryId?: string;
  questId?: string;
  coordinates: Coordinates;
  city: string;
  district?: string;
  neighborhood?: string;
  category: string;
  firstVisitedAt: string;
  lastVisitedAt: string;
  visitCount: number;
  isFirstTimeExperience: boolean;
  source: 'quest_completion' | 'memory_log';
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveryArea {
  id: string;
  name: string;
  city: string;
  neighborhood?: string;
  category: string;
  center: Coordinates;
  approxDistanceMeters: number;
  reason: string;
  suggestedDuration: string;
  budgetHint: string;
  isUnexplored: boolean;
}

export interface ExplorationSummary {
  city: string;
  totalExperiences: number;
  newPlacesCount: number;
  neighborhoodsExplored: number;
  firstTimeMoments: number;
  cellsExploredCount: number;
}
