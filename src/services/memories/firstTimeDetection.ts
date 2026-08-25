/**
 * EXTROVELA — First-Time / New-Place Detection (Phase 12) — PURE, no I/O.
 *
 * Replaces the old always-`true` first-time flags with a real computation over
 * the user's OWN prior memories. It is deliberately grounded ONLY in fields that
 * are actually persisted on a Memory (location, category, tags), so every flag it
 * returns can be substantiated from real history — never invented.
 *
 * Semantics (each flag is a distinct, stored dimension):
 *   - newPlace           : first memory at this place. Keyed on a real placeId when
 *                          one exists, otherwise on the (normalized) city. We do NOT
 *                          key on a quest title masquerading as a place — that would
 *                          make every quest look like a "new place".
 *   - newCategory        : first memory in this category.
 *   - newExperienceType  : first memory of this *kind* of experience, keyed on the
 *                          meaningful (non-generic, non-mood) tags. Falls back to
 *                          newCategory when the experience carries no type tags.
 *
 * `isFirstTimeExperience` is true when ANY of the three holds. A brand-new user
 * with no prior memories therefore gets a genuine first-time — which is correct,
 * not a hardcoded default.
 */

import { Memory, FirstTimeFlags } from '../../types/memory';

/** The already-captured facts about the experience being saved. */
export interface ExperienceDescriptor {
  city?: string;
  placeId?: string;
  category?: string;
  tags?: string[];
}

function normalize(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase();
}

/** Generic tokens that carry no "type of experience" meaning on their own. */
const GENERIC_TAGS = new Set(['experience', 'offline-safe', 'memory', 'general']);

/** Mood tokens (see MemoryMood). A mood is not an experience type. */
const MOOD_TAGS = new Set([
  'happy', 'calm', 'energized', 'inspired', 'surprised',
  'connected', 'peaceful', 'neutral', 'tired', 'disappointed',
]);

/** The meaningful, type-bearing tags of an experience (moods/generics removed). */
export function typeTagsOf(tags: string[] | undefined): string[] {
  return (tags || [])
    .map(normalize)
    .filter(t => t.length > 0 && !GENERIC_TAGS.has(t) && !MOOD_TAGS.has(t));
}

/**
 * A stable key identifying "the place" for new-place detection. Prefers a real
 * placeId; falls back to the city. Returns '' when there is no place signal at
 * all (in which case new-place cannot be honestly asserted).
 */
export function placeKey(city: string | undefined, placeId?: string): string {
  const id = normalize(placeId);
  if (id) return `id:${id}`;
  const c = normalize(city);
  if (c && c !== 'unknown location') return `city:${c}`;
  return '';
}

export function detectFirstTimeFlags(
  priorMemories: Memory[],
  descriptor: ExperienceDescriptor
): FirstTimeFlags {
  const priorPlaceKeys = new Set<string>();
  const priorCategories = new Set<string>();
  const priorTypeTags = new Set<string>();

  for (const m of priorMemories) {
    const k = placeKey(m.location?.city, m.location?.placeId);
    if (k) priorPlaceKeys.add(k);
    const cat = normalize(m.category);
    if (cat) priorCategories.add(cat);
    typeTagsOf(m.tags).forEach(t => priorTypeTags.add(t));
  }

  const key = placeKey(descriptor.city, descriptor.placeId);
  const newPlace = key !== '' && !priorPlaceKeys.has(key);

  const category = normalize(descriptor.category);
  const newCategory = category !== '' && !priorCategories.has(category);

  const descriptorTypeTags = typeTagsOf(descriptor.tags);
  const newExperienceType =
    descriptorTypeTags.length > 0
      ? descriptorTypeTags.every(t => !priorTypeTags.has(t))
      : newCategory;

  return { newPlace, newCategory, newExperienceType };
}

/** True when at least one first-time dimension holds. */
export function isFirstTimeExperience(flags: FirstTimeFlags): boolean {
  return flags.newPlace || flags.newCategory || flags.newExperienceType;
}
