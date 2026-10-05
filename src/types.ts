/** One sleep record as reported by a single source (watch, phone, ...). */
export interface SleepSession {
  source: string;
  /** ISO 8601 UTC timestamp, e.g. "2026-10-01T22:00:00Z" */
  start: string;
  /** ISO 8601 UTC timestamp, always after `start` */
  end: string;
}
 
/** One continuous block of sleep after merging. */
export interface MergedSession {
  start: string;
  end: string;
}
 
export interface MergeResult {
  /** Non-overlapping sessions, sorted by start time */
  sessions: MergedSession[];
  /** Sum of the durations of `sessions`, in whole minutes */
  totalMinutes: number;
  /** How many times two sessions were combined into one */
  overlapsMerged: number;
}