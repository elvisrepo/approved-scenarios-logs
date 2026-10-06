import type { SleepSession } from '../../src/types';

/**
 * Approved Logs file format (see the Approved Logs pattern): one JSON log line
 * per line. Line 1 is the invocation (`merge_requested` carrying the input
 * sessions); the rest is the expected emitted output. The runner replays line 1
 * through `logMerge` and compares every captured line against the whole file,
 * so a log without an invocation line is rejected before anything runs.
 */

export interface ParsedLog {
  /** The invocation line exactly as written */
  inputLine: string;
  sessions: SleepSession[];
}

/** Canonical text form: LF endings, no trailing spaces, one final newline. */
export function normalizeLog(text: string): string {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd());
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSession(value: unknown, line: string): SleepSession {
  if (!isRecord(value) || typeof value.source !== 'string' || typeof value.start !== 'string' || typeof value.end !== 'string') {
    throw new Error(`Bad session in invocation line "${line}". Expected {source, start, end} strings`);
  }
  if (Number.isNaN(Date.parse(value.start)) || Number.isNaN(Date.parse(value.end))) {
    throw new Error(`Bad timestamp in invocation line "${line}". Expected ISO 8601 UTC strings`);
  }
  return { source: value.source, start: value.start, end: value.end };
}

export function parseLog(text: string): ParsedLog {
  const lines = normalizeLog(text).split('\n');
  const inputLine = lines[0] ?? '';
  if (inputLine === '') {
    throw new Error('A log needs a first invocation line: without input it is not a test');
  }

  let first: unknown;
  try {
    first = JSON.parse(inputLine);
  } catch {
    throw new Error(`Bad invocation line "${inputLine}". Expected a JSON object`);
  }
  if (!isRecord(first) || first.event !== 'merge_requested' || !Array.isArray(first.sessions) || first.sessions.length === 0) {
    throw new Error(`Bad invocation line "${inputLine}". Expected {"event":"merge_requested","sessions":[...]}`);
  }

  return { inputLine, sessions: first.sessions.map((s) => parseSession(s, inputLine)) };
}

/** Rebuild the whole log text from the ACTUAL captured lines. */
export function renderLog(actualLines: string[]): string {
  return actualLines.join('\n') + '\n';
}
