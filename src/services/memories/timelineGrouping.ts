/**
 * EXTROVELA — Timeline Grouping (Phase 12) — PURE, no I/O, clock-free.
 *
 * Groups a user's memories into ordered period buckets (day / week / month /
 * year) for the Experience Timeline. It is deliberately pure and derives every
 * bucket from a memory's own `completedAt`, so the same input always yields the
 * same grouping regardless of when it runs. All date math is in UTC so a bucket
 * boundary never shifts with the tester's (or the device's) timezone.
 *
 * A memory whose `completedAt` is missing or unparseable is skipped rather than
 * dropped into a fabricated bucket — the timeline never invents a date.
 */

import { Memory } from '../../types/memory';

export type TimelineGrouping = 'day' | 'week' | 'month' | 'year';

export interface TimelineGroup {
  /** Stable, sortable bucket key, e.g. '2026-08' for a month. */
  key: string;
  /** Human label, e.g. 'August 2026' · 'Week of Aug 15' · 'Aug 15, 2026' · '2026'. */
  label: string;
  /** ISO start of the bucket — used only for ordering. */
  startIso: string;
  /** Members of this bucket, newest first. */
  memories: Memory[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Midnight-UTC of the Monday of the week containing `dt`. */
function mondayOfWeekUTC(dt: Date): Date {
  const day = dt.getUTCDay(); // 0=Sun … 6=Sat
  const shift = day === 0 ? -6 : 1 - day; // move back to Monday
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate() + shift));
}

interface Bucket {
  key: string;
  label: string;
  startIso: string;
}

/** The bucket a single date falls into, for the requested grouping. */
export function bucketFor(dt: Date, grouping: TimelineGrouping): Bucket {
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth();
  const d = dt.getUTCDate();

  switch (grouping) {
    case 'day': {
      const start = new Date(Date.UTC(y, m, d));
      return {
        key: `${y}-${pad(m + 1)}-${pad(d)}`,
        label: `${MONTHS_SHORT[m]} ${d}, ${y}`,
        startIso: start.toISOString(),
      };
    }
    case 'week': {
      const monday = mondayOfWeekUTC(dt);
      return {
        key: `${monday.getUTCFullYear()}-W${pad(monday.getUTCMonth() + 1)}${pad(monday.getUTCDate())}`,
        label: `Week of ${MONTHS_SHORT[monday.getUTCMonth()]} ${monday.getUTCDate()}`,
        startIso: monday.toISOString(),
      };
    }
    case 'year': {
      const start = new Date(Date.UTC(y, 0, 1));
      return { key: `${y}`, label: `${y}`, startIso: start.toISOString() };
    }
    case 'month':
    default: {
      const start = new Date(Date.UTC(y, m, 1));
      return { key: `${y}-${pad(m + 1)}`, label: `${MONTHS[m]} ${y}`, startIso: start.toISOString() };
    }
  }
}

/**
 * Groups memories into ordered buckets (newest bucket first; newest memory first
 * within each bucket). Pure: no `Date.now()`, no mutation of the input array.
 */
export function groupMemoriesByPeriod(memories: Memory[], grouping: TimelineGrouping): TimelineGroup[] {
  const byKey = new Map<string, TimelineGroup>();

  for (const memory of memories) {
    const raw = memory.completedAt;
    if (!raw) continue;
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) continue;

    const bucket = bucketFor(dt, grouping);
    const existing = byKey.get(bucket.key);
    if (existing) {
      existing.memories.push(memory);
    } else {
      byKey.set(bucket.key, { ...bucket, memories: [memory] });
    }
  }

  const groups = Array.from(byKey.values());
  // Newest bucket first.
  groups.sort((a, b) => (a.startIso < b.startIso ? 1 : a.startIso > b.startIso ? -1 : 0));
  // Newest memory first within a bucket.
  for (const g of groups) {
    g.memories.sort((a, b) => {
      const ta = new Date(a.completedAt).getTime();
      const tb = new Date(b.completedAt).getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
  }
  return groups;
}
