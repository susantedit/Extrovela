/**
 * EXTROVELA — Reflection Enhancer Service Abstraction (Phase 7)
 * 
 * Future AI reflection assistance interface.
 * Core rule: User original reflection text must ALWAYS remain accessible and untouched.
 */

export interface ReflectionEnhancementOptions {
  includeSensoryDetails?: boolean;
  poeticTone?: boolean;
  length?: 'concise' | 'detailed';
}

export interface EnhancedReflectionResult {
  originalText: string;
  suggestedTitle?: string;
  suggestedTags?: string[];
  enhancedNarrative?: string;
  isAiGenerated: boolean;
}

export class ReflectionEnhancer {
  /**
   * Generates optional narrative enhancements or contextual titles.
   * Note: Original text is always preserved.
   */
  async enhanceReflection(
    userText: string,
    questTitle: string,
    options?: ReflectionEnhancementOptions
  ): Promise<EnhancedReflectionResult> {
    // Current initial implementation preserves raw user input intact
    return {
      originalText: userText,
      suggestedTitle: userText.length > 0 && userText.length < 35 ? userText : questTitle,
      suggestedTags: [],
      enhancedNarrative: userText,
      isAiGenerated: false,
    };
  }

  /**
   * Generates contextual prompts based on quest category and mood.
   */
  getContextualPrompts(category?: string, mood?: string): string[] {
    const prompts = [
      "What surprised you about this experience?",
      "What would you remember about today?",
      "Would you do this again?",
      "Did this feel different from your usual day?",
      "What sound or smell stayed with you?",
    ];

    if (category === 'Nature' || category === 'Outdoor') {
      prompts.unshift("What details in nature did you notice for the first time?");
    } else if (category === 'Sanctuary' || category === 'Tea') {
      prompts.unshift("How did the space feel around you?");
    } else if (mood === 'Peaceful' || mood === 'Reflective') {
      prompts.unshift("What shifted inside you during these quiet moments?");
    }

    return prompts;
  }
}

export const reflectionEnhancer = new ReflectionEnhancer();
export default reflectionEnhancer;
