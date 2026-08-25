/**
 * EXTROVELA — Phase 11: Sensitive Attribute Guard
 *
 * HARD PRIVACY BOUNDARY. Every derived write (preference signal, experience
 * memory, graph node, profile dimension) passes through this module first.
 *
 * The app must NEVER infer or store:
 *   religion · political belief · sexual orientation · medical condition
 *   mental-health diagnosis · race · ethnicity · criminal history
 *   financial status beyond the explicit quest budget band
 *
 * This is a denylist, which is imperfect by nature — so it is applied as a
 * *rejection* gate on candidate derived values (a bounded, enumerable set we
 * generate ourselves), not as a scrubber on arbitrary user prose. User prose
 * is never stored in derived data at all.
 */

import logger from '../../utils/logger';

/** Categories of attribute we refuse to derive, store, or send to an LLM. */
export type SensitiveCategory =
  | 'religion'
  | 'politics'
  | 'sexualOrientation'
  | 'medical'
  | 'mentalHealth'
  | 'raceEthnicity'
  | 'criminalHistory'
  | 'financialStatus';

const SENSITIVE_TERMS: Record<SensitiveCategory, string[]> = {
  religion: [
    'religion', 'religious', 'christian', 'muslim', 'islam', 'hindu', 'hinduism',
    'buddhist', 'buddhism', 'jewish', 'judaism', 'sikh', 'atheist', 'agnostic',
    'church', 'mosque', 'synagogue', 'faith', 'worship', 'baptist', 'catholic',
    'orthodox', 'evangelical', 'prayer group', 'bible', 'quran', 'torah',
  ],
  politics: [
    'political', 'politics', 'liberal', 'conservative', 'leftist', 'right-wing',
    'communist', 'socialist', 'republican', 'democrat', 'maoist', 'congress party',
    'vote', 'voter', 'election', 'party affiliation', 'activist', 'protest march',
  ],
  sexualOrientation: [
    'gay', 'lesbian', 'bisexual', 'queer', 'homosexual', 'heterosexual', 'straight',
    'lgbt', 'lgbtq', 'transgender', 'nonbinary', 'sexual orientation', 'gender identity',
    'dating men', 'dating women', 'sexuality',
  ],
  medical: [
    'diagnosis', 'diabetes', 'diabetic', 'cancer', 'asthma', 'epilepsy', 'hiv',
    'pregnant', 'pregnancy', 'chronic pain', 'disability', 'medication', 'prescription',
    'surgery', 'chemotherapy', 'blood pressure', 'heart condition', 'illness',
    'symptom', 'therapy session', 'medical condition', 'disorder',
  ],
  mentalHealth: [
    'depression', 'depressed', 'anxiety disorder', 'anxious disorder', 'bipolar',
    'ptsd', 'adhd', 'autism', 'autistic', 'ocd', 'schizophrenia', 'suicidal',
    'self-harm', 'eating disorder', 'panic attack', 'psychiatrist', 'psychiatric',
    'antidepressant', 'mental illness', 'mental health condition', 'trauma survivor',
    'burnout diagnosis', 'therapist',
  ],
  raceEthnicity: [
    'race', 'racial', 'ethnicity', 'ethnic group', 'caste', 'dalit', 'brahmin',
    'newar', 'tharu', 'madhesi', 'indigenous', 'black', 'white person', 'asian person',
    'latino', 'hispanic', 'immigrant status', 'nationality group',
  ],
  criminalHistory: [
    'arrest', 'arrested', 'convicted', 'conviction', 'felony', 'prison', 'jail',
    'criminal record', 'probation', 'parole', 'lawsuit', 'court case', 'police record',
  ],
  financialStatus: [
    'salary', 'income', 'net worth', 'debt', 'loan', 'bankrupt', 'bankruptcy',
    'credit score', 'poor', 'wealthy', 'rich', 'broke', 'unemployed', 'welfare',
    'financial situation', 'cannot afford rent', 'savings account',
  ],
};

export interface SensitiveScanResult {
  isSensitive: boolean;
  categories: SensitiveCategory[];
  matchedTerms: string[];
}

/**
 * Scans a candidate derived string for sensitive attribute content.
 * Word-boundary matched to avoid false positives such as "straightforward"
 * or "racecourse".
 */
export function scanForSensitiveContent(text: string): SensitiveScanResult {
  const categories: SensitiveCategory[] = [];
  const matchedTerms: string[] = [];

  if (!text || typeof text !== 'string') {
    return { isSensitive: false, categories, matchedTerms };
  }

  const haystack = text.toLowerCase();

  for (const [category, terms] of Object.entries(SENSITIVE_TERMS) as Array<
    [SensitiveCategory, string[]]
  >) {
    for (const term of terms) {
      // Escape regex metacharacters, then require word boundaries.
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
      if (pattern.test(haystack)) {
        if (!categories.includes(category)) categories.push(category);
        matchedTerms.push(term);
      }
    }
  }

  return { isSensitive: categories.length > 0, categories, matchedTerms };
}

/**
 * Gate for derived preference-signal values. Returns false when the value
 * must not be stored. Logs the *category* only — never the offending text.
 */
export function isSafeDerivedValue(value: string): boolean {
  const scan = scanForSensitiveContent(value);
  if (scan.isSensitive) {
    logger.warn('Rejected derived value: sensitive attribute category detected', {
      categories: scan.categories,
    });
    return false;
  }
  return true;
}

/**
 * Gate for long-term memory statements. Additionally rejects clinical or
 * diagnostic phrasing and second-person emotional claims, which the spec
 * forbids even when not strictly a protected attribute.
 */
const FORBIDDEN_STATEMENT_PATTERNS: RegExp[] = [
  /\byou (?:are|seem|appear|might be|may be|must be)\s+(?:depressed|anxious|lonely|sad|unhappy|struggling|traumatized)\b/i,
  /\b(?:diagnos|clinical|patholog|psychiatr)/i,
  /\byou (?:became|have become|are becoming)\s+(?:happier|healthier|calmer|better)\b/i,
  /\byour mental health\b/i,
  /\byou suffer\b/i,
];

export interface StatementValidation {
  valid: boolean;
  reason?: string;
}

export function validateMemoryStatement(statement: string): StatementValidation {
  if (!statement || statement.trim().length === 0) {
    return { valid: false, reason: 'empty_statement' };
  }
  if (statement.length > 240) {
    return { valid: false, reason: 'statement_too_long' };
  }

  const scan = scanForSensitiveContent(statement);
  if (scan.isSensitive) {
    return { valid: false, reason: `sensitive_attribute:${scan.categories.join(',')}` };
  }

  for (const pattern of FORBIDDEN_STATEMENT_PATTERNS) {
    if (pattern.test(statement)) {
      return { valid: false, reason: 'clinical_or_emotional_claim' };
    }
  }

  return { valid: true };
}

/**
 * Redacts a natural-language preference the user typed so we can tell them
 * *why* it was rejected without ever persisting the sensitive content.
 */
export function describeSensitiveRejection(scan: SensitiveScanResult): string {
  if (!scan.isSensitive) return '';
  const labels: Record<SensitiveCategory, string> = {
    religion: 'religion or belief',
    politics: 'political views',
    sexualOrientation: 'sexual orientation or gender identity',
    medical: 'health conditions',
    mentalHealth: 'mental health',
    raceEthnicity: 'race, ethnicity or caste',
    criminalHistory: 'legal history',
    financialStatus: 'financial circumstances',
  };
  const list = scan.categories.map(c => labels[c]).join(', ');
  return `EXTROVELA does not store preferences about ${list}. That part was not saved.`;
}

export default {
  scanForSensitiveContent,
  isSafeDerivedValue,
  validateMemoryStatement,
  describeSensitiveRejection,
};
