// EXTROVELA — Quest Quality & Safety Validator (Sections 33-34)
// Enforces strict AI guardrails before any quest candidate reaches the mobile/client app.

const FORBIDDEN_WORDS = [
  'trespass',
  'private property',
  'climb fence',
  'danger',
  'abandoned hospital',
  'restricted area',
  'illegal',
];

export function validateQuest(quest, context) {
  const issues = [];

  // 1. Schema Validation
  if (!quest.title || typeof quest.title !== 'string' || quest.title.length < 5) {
    issues.push('Invalid or missing quest title');
  }
  if (!quest.description || typeof quest.description !== 'string' || quest.description.length < 15) {
    issues.push('Description too short or invalid');
  }
  if (!quest.category || !quest.environment || !quest.mood) {
    issues.push('Missing required taxonomy metadata');
  }

  // 2. Safety Guardrails (Section 33)
  const fullText = `${quest.title} ${quest.description}`.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (fullText.includes(word)) {
      issues.push(`Safety violation: contains prohibited prompt/action "${word}"`);
    }
  }

  // 3. Time Safety Validator (No hazardous night exploration)
  const hour = context?.timeHour !== undefined ? context.timeHour : new Date().getHours();
  if (hour >= 22 || hour <= 4) {
    if (quest.environment === 'Nature' || quest.environment === 'Outdoor') {
      issues.push('Safety violation: Hazardous outdoor exploration suggested during late night hours');
    }
  }

  // 4. Weather Validator
  if (context?.isRain) {
    if (quest.environment === 'Outdoor' && !fullText.includes('rain') && !fullText.includes('umbrella')) {
      quest.environment = 'Indoor';
    }
  }

  // 5. Sanitize
  const sanitized = {
    ...quest,
    id: quest.id || `quest_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    title: quest.title?.trim(),
    description: quest.description?.trim(),
    tags: Array.isArray(quest.tags) ? quest.tags : ['experience'],
  };

  return {
    isValid: issues.length === 0,
    issues,
    sanitizedQuest: sanitized,
  };
}

export function validateQuestList(quests, context) {
  if (!Array.isArray(quests)) return [];
  return quests
    .map(q => validateQuest(q, context))
    .filter(res => res.isValid)
    .map(res => res.sanitizedQuest);
}
