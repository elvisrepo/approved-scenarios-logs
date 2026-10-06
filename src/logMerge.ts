import { mergeSleep } from './mergeSleep';
import type { SleepSession } from './types';

/**
 * Structured log events emitted by {@link logMerge}, one JSON object per line.
 *
 * The first line is always `merge_requested` and carries the invocation input,
 * so an Approved Logs runner can replay it: parse line 1, call the entry
 * point, and compare every captured line against the approved `.log` file.
 */
export type MergeLogEvent =
  | { event: 'merge_requested'; count: number }
  | { event: 'session_merged'; start: string; end: string }
  | { event: 'merge_completed'; totalMinutes: number; overlapsMerged: number };

/**
 * Run {@link mergeSleep} and describe the run as structured log lines.
 *
 * Pure by design: lines are returned, not printed, so the Approved Logs runner
 * (or any transport) can capture and compare them deterministically. The
 * merging itself stays in `mergeSleep`, which performs no I/O and no logging.
 *
 * @param sessions - Sleep records from any number of sources, in any order.
 * @returns One JSON-encoded {@link MergeLogEvent} per line: first
 * `merge_requested`, then one `session_merged` per merged block, then a final
 * `merge_completed` summary.
 *
 * @example
 * ```ts
 * logMerge([
 *   { source: 'fitbit', start: '2026-10-01T22:00:00Z', end: '2026-10-02T06:00:00Z' },
 *   { source: 'phone', start: '2026-10-01T22:00:00Z', end: '2026-10-02T06:00:00Z' },
 * ]);
 * // ['{"event":"merge_requested","count":2}',
 * //  '{"event":"session_merged","start":"2026-10-01T22:00:00Z","end":"2026-10-02T06:00:00Z"}',
 * //  '{"event":"merge_completed","totalMinutes":480,"overlapsMerged":1}']
 * ```
 */
export function logMerge(sessions: SleepSession[]): string[] {
  const lines: string[] = [JSON.stringify({ event: 'merge_requested', count: sessions.length } satisfies MergeLogEvent)];

  const result = mergeSleep(sessions);

  for (const session of result.sessions) {
    lines.push(JSON.stringify({ event: 'session_merged', start: session.start, end: session.end } satisfies MergeLogEvent));
  }

  lines.push(
    JSON.stringify({
      event: 'merge_completed',
      totalMinutes: result.totalMinutes,
      overlapsMerged: result.overlapsMerged,
    } satisfies MergeLogEvent),
  );

  return lines;
}
