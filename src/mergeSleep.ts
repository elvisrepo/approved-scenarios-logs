import type { MergeResult, SleepSession } from './types';
 
/**
 * Merge sleep sessions from several sources into clean, non-overlapping sessions.
 *
 * Sessions are sorted by start time, then swept once, extending the current
 * block whenever the next session genuinely overlaps it. Sessions that only
 * touch (one ends exactly when the next begins) share no minutes and are kept
 * separate, so they do not count toward `overlapsMerged`.
 *
 * @param sessions - Sleep records from any number of sources, in any order.
 * @returns The merged, non-overlapping sessions sorted by start time, their
 * total duration in whole minutes, and how many overlaps were combined.
 *
 * @example
 * ```ts
 * mergeSleep([
 *   { source: 'fitbit', start: '2026-10-01T22:00:00Z', end: '2026-10-02T06:00:00Z' },
 *   { source: 'phone', start: '2026-10-01T22:30:00Z', end: '2026-10-02T06:30:00Z' },
 * ]);
 * // { sessions: [{ start: '2026-10-01T22:00:00Z', end: '2026-10-02T06:30:00Z' }],
 * //   totalMinutes: 510, overlapsMerged: 1 }
 * ```
 */
export function mergeSleep(sessions: SleepSession[]): MergeResult {
  if (sessions.length === 0) {
    return { sessions: [], totalMinutes: 0, overlapsMerged: 0 };
  }

  // Sort a copy by start time so input order never affects the result.
  const intervals = sessions.map((s) => ({
    startMs: Date.parse(s.start),
    endMs: Date.parse(s.end),
  }));

  intervals.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const merged: { startMs: number; endMs: number }[] = [];
  let overlapsMerged = 0;

  // Single sweep: extend the open block on true overlap (< keeps touching
  // sessions separate); otherwise close it and start a new one.
  let current = intervals[0]!;
  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i]!;
    if (next.startMs < current.endMs) {
      if (next.endMs > current.endMs) {
        current.endMs = next.endMs;
      }
      overlapsMerged += 1;
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return {
    sessions: merged.map((m) => ({
      start: toIso(m.startMs),
      end: toIso(m.endMs),
    })),
    totalMinutes: merged.reduce(
      (sum, m) => sum + Math.round((m.endMs - m.startMs) / 60_000),
      0,
    ),
    overlapsMerged,
  };
}

/**
 * Format epoch milliseconds as the canonical ISO 8601 UTC form used by this
 * package (`"2026-10-01T22:00:00Z"`, without the `.000` millis suffix).
 */
function toIso(ms: number): string {
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}