/**
 * EXTROVELA — Quest Engine Personalization Scorer
 * 
 * Computes a weighted, multi-dimensional score for every valid candidate quest:
 * finalScore = preferenceScore + contextScore + noveltyScore + diversityScore - repetitionPenalty - dislikePenalty
 */

import { EngineContext, QuestCandidate } from '../types';

export class PersonalizationScorer {
  static score(candidate: QuestCandidate, context: EngineContext): QuestCandidate {
    let preferenceScore = 0;
    let contextScore = 0;
    let noveltyScore = 0;
    let diversityScore = 0;
    let repetitionPenalty = 0;
    let dislikePenalty = 0;

    // 1. Preference Score (Interest & Mood Alignment)
    const userInterests = (context.preferences.interests || []).map((i: string) => i.toLowerCase());
    const candidateTags = (candidate.tags || []).map(t => t.toLowerCase());

    for (const tag of candidateTags) {
      if (userInterests.some((interest: string) => interest.includes(tag) || tag.includes(interest))) {
        preferenceScore += 25;
      }
    }

    if (candidate.social.toLowerCase() === (context.preferences.socialPreference || 'solo').toLowerCase()) {
      preferenceScore += 15;
    }

    // 2. Context Score (Time of Day & Environment Alignment)
    const timeOfDay = context.time.timeOfDay;
    if ((timeOfDay === 'afternoon' || timeOfDay === 'evening') && candidate.tags.includes('sunset')) {
      contextScore += 30; // Golden hour boost
    }
    if (timeOfDay === 'earlyMorning' && (candidate.tags.includes('morning') || candidate.tags.includes('tea'))) {
      contextScore += 25;
    }

    // 3. Novelty & Exploration Boost
    const isNewCategory = !context.recentCategories.includes(candidate.category);
    if (isNewCategory) {
      noveltyScore += 20;
    }

    // 4. Repetition Penalty
    const recentFingerprints = context.recentQuests.map(q => (q as any).fingerprint || q.title.toLowerCase());
    if (recentFingerprints.includes(candidate.fingerprint) || recentFingerprints.includes(candidate.title.toLowerCase())) {
      repetitionPenalty += 50; // Heavy penalty on recently seen experiences
    }

    // 5. Experience Balance / Diversity Boost
    const recentOutdoorCount = context.recentQuests.filter(q => q.environment === 'Outdoor').length;
    if (recentOutdoorCount >= 3 && candidate.environment === 'Indoor') {
      diversityScore += 15; // Gently balance indoor/outdoor
    } else if (recentOutdoorCount === 0 && candidate.environment === 'Outdoor') {
      diversityScore += 15;
    }

    // 6. Weather-fit Score (Phase 13). Deliberately 0 when weather is unknown, so
    //    a context with no weather produces a byte-identical score/breakdown to the
    //    pre-Phase-13 engine. Only nudges when we have a real, normalized condition.
    let weatherScore = 0;
    const cond = context.weather?.normalizedCondition;
    if (cond) {
      const wet = cond === 'rain' || cond === 'heavyRain' || cond === 'storm' || cond === 'snow';
      const fair = cond === 'clear' || cond === 'partlyCloudy';
      if (wet && candidate.environment === 'Indoor') weatherScore += 20;
      else if (fair && candidate.environment === 'Outdoor') weatherScore += 15;
    }

    const finalScore = Math.max(
      0,
      preferenceScore + contextScore + noveltyScore + diversityScore + weatherScore - repetitionPenalty - dislikePenalty
    );

    return {
      ...candidate,
      rawScore: finalScore,
      scoreBreakdown: {
        preferenceScore,
        contextScore,
        noveltyScore,
        diversityScore,
        repetitionPenalty,
        dislikePenalty,
        weatherScore,
        finalScore,
      },
    };
  }
}
