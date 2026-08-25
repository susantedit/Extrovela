// EXTROVELA — Experience Graph & Quality Scoring Service (Sections 10 & 36)

export function calculateExperienceQuality(memories) {
  if (!memories || memories.length === 0) {
    return {
      totalExperiences: 0,
      experienceQualityScore: 0,
      meaningfulExperiencesCount: 0,
      meaningfulPerActiveUser: 0,
      crowdToleranceRatio: 0.5,
      topCategories: [],
    };
  }

  const total = memories.length;
  const avgMood = memories.reduce((acc, m) => acc + (m.moodRating || 4), 0) / total;
  const firstTimes = memories.filter(m => m.isFirstTimeExperience).length;
  const detailedReflections = memories.filter(m => m.reflectionText && m.reflectionText.length >= 25).length;

  // Meaningful experience: rated 4 or 5 stars with thoughtful reflection
  const meaningful = memories.filter(m => (m.moodRating >= 4) && m.reflectionText && m.reflectionText.length >= 20).length;

  // Formula: (Mood/5 * 5.0) + (FirstTimeRatio * 2.5) + (ReflectionRatio * 2.5) -> max 10.0
  const score = Number(((avgMood / 5.0) * 5.0 + (firstTimes / total) * 2.5 + (detailedReflections / total) * 2.5).toFixed(1));

  // Extract category counts
  const categoryMap = {};
  memories.forEach(m => {
    (m.tags || []).forEach(t => {
      categoryMap[t] = (categoryMap[t] || 0) + 1;
    });
  });

  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(entry => entry[0]);

  return {
    totalExperiences: total,
    experienceQualityScore: Math.min(10.0, score),
    meaningfulExperiencesCount: meaningful,
    meaningfulPerActiveUser: Number((meaningful / Math.max(1, Math.ceil(total / 8))).toFixed(1)),
    crowdToleranceRatio: 0.3,
    topCategories,
  };
}
