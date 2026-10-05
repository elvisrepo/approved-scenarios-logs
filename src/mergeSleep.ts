import type { MergeResult, SleepSession } from './types';
 
/**
 * Merge sleep sessions from several sources into clean, non-overlapping sessions.
 */
export function mergeSleep(sessions: SleepSession[]): MergeResult {
  if (sessions.length === 0) {
    return { sessions: [], totalMinutes: 0, overlapsMerged: 0 };
  }

  const intervals = sessions.map((s) => ({
    startMs: Date.parse(s.start),
    endMs: Date.parse(s.end),
  }));

  intervals.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const merged: { startMs: number; endMs: number }[] = [];
  let overlapsMerged = 0;

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

function toIso(ms: number): string {
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}