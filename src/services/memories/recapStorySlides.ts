/**
 * EXTROVELA — Recap Story Slides (Phase 12) — PURE, no I/O.
 *
 * Turns an already-computed ExperienceRecap into the ordered slides of "Story
 * Mode". Every line is built from the recap's VERIFIED facts (stats computed
 * on-device, real places, real firsts, real highlight titles) or, for the single
 * narrative slide, from a narrative that has ALREADY passed both grounding gates
 * in recapGenerationService. This function invents nothing: if a number is not in
 * `recap.stats`, no slide can show it, and the narrative slide only exists when
 * `recap.narrativeAvailable` is true.
 */

import { ExperienceRecap } from '../../types/recap';

export type RecapSlideKind = 'intro' | 'places' | 'firsts' | 'balance' | 'highlights' | 'narrative' | 'outro';

export interface RecapStorySlide {
  kind: RecapSlideKind;
  heading: string;
  lines: string[];
  accent: 'lime' | 'gold' | 'cream';
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function buildRecapStorySlides(recap: ExperienceRecap): RecapStorySlide[] {
  const s = recap.stats;

  // An empty period gets one honest slide — never fabricated activity.
  if (s.totalExperiences === 0) {
    return [
      {
        kind: 'intro',
        heading: recap.periodLabel,
        lines: ['No experiences logged in this period yet.', 'Your story starts the next time you head out.'],
        accent: 'gold',
      },
    ];
  }

  const slides: RecapStorySlide[] = [];

  slides.push({
    kind: 'intro',
    heading: recap.periodLabel,
    lines: [plural(s.totalExperiences, 'experience', 'experiences'), 'made real.'],
    accent: 'lime',
  });

  if (s.newPlaces > 0 || recap.places.length > 0) {
    const lines = recap.places.slice(0, 4);
    lines.push(plural(s.newPlaces, 'new place', 'new places'));
    slides.push({ kind: 'places', heading: 'New ground', lines, accent: 'lime' });
  }

  if (s.firstTimes > 0 || recap.firsts.length > 0) {
    const lines = recap.firsts.slice(0, 4);
    lines.push(plural(s.firstTimes, 'first-time', 'first-times'));
    slides.push({ kind: 'firsts', heading: 'Firsts', lines, accent: 'gold' });
  }

  const balance: string[] = [];
  if (s.soloCount + s.socialCount > 0) balance.push(`${s.soloCount} solo · ${s.socialCount} shared`);
  if (s.indoorCount + s.outdoorCount > 0) balance.push(`${s.outdoorCount} outdoors · ${s.indoorCount} indoors`);
  if (s.averageRating > 0) balance.push(`${s.averageRating.toFixed(1)} average rating`);
  if (balance.length > 0) {
    slides.push({ kind: 'balance', heading: 'How it felt', lines: balance, accent: 'cream' });
  }

  if (recap.highlights.length > 0) {
    slides.push({
      kind: 'highlights',
      heading: 'Moments that stayed',
      lines: recap.highlights.slice(0, 4).map(h => h.title),
      accent: 'gold',
    });
  }

  // The narrative slide exists ONLY when a grounded narrative was produced.
  if (recap.narrativeAvailable && recap.narrative) {
    slides.push({
      kind: 'narrative',
      heading: recap.narrativeTitle || 'Your story',
      lines: [recap.narrative],
      accent: 'lime',
    });
  }

  slides.push({
    kind: 'outro',
    heading: 'The shape of it',
    lines: [
      plural(s.distinctCategories, 'kind of experience', 'kinds of experience'),
      plural(s.distinctCities, 'city', 'cities'),
      plural(s.favoriteCount, 'favorite', 'favorites'),
    ],
    accent: 'cream',
  });

  return slides;
}
