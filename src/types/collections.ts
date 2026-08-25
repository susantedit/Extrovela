/**
 * EXTROVELA — Memory Collection Contracts (Phase 12)
 *
 * Two kinds of collection:
 *   - manual: the user hand-picks memories. `memoryIds` is the membership.
 *   - smart:  membership is computed from a transparent, declarative rule that
 *             runs entirely on-device over the user's own memories. No LLM, no
 *             opaque scoring — the user can always see exactly why a memory is in.
 *
 * `isSmart` is frozen after creation (Firestore rule), so the badge a user sees
 * ("Smart" vs hand-curated) can never quietly change meaning.
 */

export type CollectionKind = 'manual' | 'smart';

export type SmartRuleField =
  | 'tag'
  | 'category'
  | 'city'
  | 'mood'
  | 'favorite'
  | 'firstTime'
  | 'outdoor'
  | 'indoor';

export interface SmartRuleClause {
  field: SmartRuleField;
  /** Required for tag/category/city/mood; ignored for the boolean fields. */
  value?: string;
}

export interface SmartCollectionRule {
  match: 'all' | 'any';
  clauses: SmartRuleClause[];
}

export interface MemoryCollection {
  id: string;
  userId: string;
  name: string; // Firestore rule caps this at 80 chars
  description?: string;
  isSmart: boolean; // immutable after create
  icon?: string;
  coverMemoryId?: string;
  memoryIds: string[]; // manual membership (empty for smart collections)
  rule?: SmartCollectionRule; // present iff isSmart
  createdAt: string;
  updatedAt: string;
}
