/**
 * EXTROVELA — Exploration Grid & Cell Aggregation Service (Phase 8)
 * 
 * Maps completed memories into discrete exploration cells (~500m radius) without
 * running continuous GPS tracking or creating excessive database documents.
 */

import { Coordinates } from '../../types/place';
import { ExplorationCell, ExplorationSummary, ExplorationRecord } from './explorationTypes';
import { Memory } from '../../types/memory';

export class ExplorationGridService {
  /**
   * Generates a discrete cell code (~500m precision, 2 decimal places)
   */
  static getCellCode(coords: Coordinates): string {
    const lat = coords.lat.toFixed(2);
    const lng = coords.lng.toFixed(2);
    return `cell_${lat}_${lng}`;
  }

  static generateCellsFromMemories(userId: string, memories: Memory[]): ExplorationCell[] {
    const cellMap = new Map<string, ExplorationCell>();

    memories.forEach(m => {
      if (!m.location?.lat || !m.location?.lng) return;

      const code = this.getCellCode({ lat: m.location.lat, lng: m.location.lng });
      const existing = cellMap.get(code);

      if (existing) {
        existing.experienceCount += 1;
        existing.memoryCount += 1;
        existing.lastExploredAt = m.completedAt;
        (m.tags || []).forEach(t => {
          if (!existing.categories.includes(t)) existing.categories.push(t);
        });
      } else {
        cellMap.set(code, {
          id: `cell_${code}`,
          userId,
          cellCode: code,
          center: { lat: m.location.lat, lng: m.location.lng },
          experienceCount: 1,
          memoryCount: 1,
          firstExploredAt: m.completedAt,
          lastExploredAt: m.completedAt,
          categories: [...(m.tags || [])],
        });
      }
    });

    return Array.from(cellMap.values());
  }

  static computeSummary(city = 'Kathmandu', memories: Memory[], records: ExplorationRecord[]): ExplorationSummary {
    const cells = this.generateCellsFromMemories('user_active', memories);
    const firstTimes = memories.filter(m => m.isFirstTimeExperience).length;
    const uniquePlaces = new Set(records.map(r => r.placeId || r.id)).size;

    return {
      city,
      totalExperiences: memories.length,
      newPlacesCount: uniquePlaces || firstTimes,
      neighborhoodsExplored: Math.max(1, Math.ceil(cells.length * 1.5)),
      firstTimeMoments: firstTimes,
      cellsExploredCount: cells.length,
    };
  }
}
