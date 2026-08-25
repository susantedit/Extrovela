/**
 * EXTROVELA — Experience Statistics Service (Phase 7)
 * 
 * Computes genuine memory insights and monthly retrospectives without gamification pressure.
 */

import { Memory, ExperienceStats } from '../../types/memory';

export interface DetailedExperienceStats extends ExperienceStats {
  newPlacesCount: number;
  firstTimeCount: number;
  averageRating: number;
  topCategories: string[];
  monthlyBreakdown: Record<string, number>;
}

export class ExperienceStatsService {
  static computeStats(memories: Memory[]): DetailedExperienceStats {
    const totalExperiences = memories.length;
    const firstTimeCount = memories.filter(
      m => m.isFirstTimeExperience || m.firstTimeFlags?.newExperienceType
    ).length;
    const newPlacesCount = memories.filter(
      m => m.firstTimeFlags?.newPlace || (m.location && m.isFirstTimeExperience)
    ).length;
    const favoriteExperiences = memories.filter(m => m.isFavorite).length;

    let soloCount = 0;
    let socialCount = 0;
    let indoorCount = 0;
    let outdoorCount = 0;
    let totalRating = 0;

    const categoryCountMap = new Map<string, number>();
    const monthlyMap: Record<string, number> = {};

    memories.forEach(m => {
      totalRating += m.rating || m.moodRating || 5;

      const tags = (m.tags || []).map(t => t.toLowerCase());
      if (tags.includes('solo') || tags.includes('quiet')) soloCount++;
      if (tags.includes('social') || tags.includes('friends') || tags.includes('group')) socialCount++;
      if (tags.includes('indoor') || tags.includes('sanctuary') || tags.includes('teahouse')) indoorCount++;
      if (tags.includes('outdoor') || tags.includes('nature') || tags.includes('scenic')) outdoorCount++;

      if (m.category) {
        categoryCountMap.set(m.category, (categoryCountMap.get(m.category) || 0) + 1);
      }
      (m.tags || []).forEach(t => {
        categoryCountMap.set(t, (categoryCountMap.get(t) || 0) + 1);
      });

      const date = new Date(m.completedAt);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + 1;
    });

    const averageRating = totalExperiences > 0 ? Number((totalRating / totalExperiences).toFixed(1)) : 5.0;

    const topCategories = Array.from(categoryCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(entry => entry[0]);

    return {
      period: 'total',
      totalExperiences,
      newPlaces: newPlacesCount,
      newPlacesCount,
      firstTimeExperiences: firstTimeCount,
      firstTimeCount,
      soloExperiences: soloCount,
      socialExperiences: socialCount,
      indoorExperiences: indoorCount,
      outdoorExperiences: outdoorCount,
      favoriteExperiences,
      averageRating,
      topCategories,
      monthlyBreakdown: monthlyMap,
      updatedAt: new Date().toISOString(),
    };
  }
}

export default ExperienceStatsService;

