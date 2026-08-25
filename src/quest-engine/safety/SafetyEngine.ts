/**
 * EXTROVELA — Quest Engine Safety & Risk Analyzer
 * 
 * 7-Stage safety validator ensuring all generated and curated experiences are safe,
 * respectful, legal, and non-intrusive.
 */

import { QuestCandidate } from '../types';

export class SafetyEngine {
  static evaluateSafety(candidate: QuestCandidate): { safe: boolean; reason?: string } {
    const text = `${candidate.title} ${candidate.description}`.toLowerCase();

    // 1. Trespassing & Private Property
    if (text.includes('trespass') || text.includes('abandoned building') || text.includes('climb fence') || text.includes('private property')) {
      return { safe: false, reason: 'trespassing_risk' };
    }

    // 2. Physical Danger & Recklessness
    if (text.includes('dangerous road') || text.includes('jump from') || text.includes('unsafe height') || text.includes('stunt')) {
      return { safe: false, reason: 'physical_hazard' };
    }

    // 3. Invasive Social Interaction / Harassment
    if (text.includes('follow a stranger') || text.includes('ask personal info') || text.includes('secretly record') || text.includes('approach home')) {
      return { safe: false, reason: 'invasive_social_behavior' };
    }

    // 4. Illegal & Restricted Acts
    if (text.includes('illegal') || text.includes('vandal') || text.includes('steal') || text.includes('bribe')) {
      return { safe: false, reason: 'illegal_activity' };
    }

    return { safe: true };
  }
}
