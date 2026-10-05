import type { MergeResult, SleepSession } from '../../src/types';
 
/**
 * Scenario file format. This is an external DSL (see the Constrained Tests pattern):
 * the parser below rejects a file that has no expected output, so a hollow test cannot exist.
 *
 *   # Title
 *
 *   ## Input
 *   <source>  HH:MM-HH:MM         one line per session
 *
 *   ## Result
 *   sessions: HH:MM-HH:MM, ...    or "none"
 *   total_minutes: <number>
 *   overlaps_merged: <number>
 *
 * Times are UTC. A scenario covers one "night": it runs from 18:00 on the first day to
 * 18:00 on the next day. So 22:00-06:00 means 22:00 today to 06:00 tomorrow, and a
 * 14:00-14:45 nap means 14:00 tomorrow.
 */
 
const BASE_MS = Date.parse('2026-10-01T18:00:00Z');
const NIGHT_STARTS_AT = 18 * 60;
const MINUTES_PER_DAY = 24 * 60;
 
const RESULT_KEYS = ['sessions', 'total_minutes', 'overlaps_merged'] as const;
 
export interface ParsedScenario {
  title: string;
  /** The input lines exactly as written, so the rendered file keeps the author's spacing */
  inputLines: string[];
  sessions: SleepSession[];
}
 
/** Canonical text form used for comparing files: LF endings, no trailing spaces, one final newline. */
export function normalizeText(text: string): string {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd());
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}
 
function sectionLines(lines: string[], header: string): string[] | undefined {
  const start = lines.indexOf(header);
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => line.startsWith('## '));
  const body = next === -1 ? rest : rest.slice(0, next);
  return body.filter((line) => line.trim() !== '');
}
 
function minutesIntoNight(hours: number, minutes: number): number {
  return (((hours * 60 + minutes - NIGHT_STARTS_AT) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}
 
function isoAt(minutesIntoNightValue: number): string {
  return new Date(BASE_MS + minutesIntoNightValue * 60_000).toISOString().replace('.000Z', 'Z');
}
 
function parseClock(text: string, line: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  const hours = Number(match?.[1]);
  const minutes = Number(match?.[2]);
  if (!match || hours > 23 || minutes > 59) {
    throw new Error(`Bad time "${text}" in input line "${line}"`);
  }
  return minutesIntoNight(hours, minutes);
}
 
function parseSessionLine(line: string): SleepSession {
  const parts = line.trim().split(/\s+/);
  const [source, range] = parts;
  const [from, to] = (range ?? '').split('-');
  if (parts.length !== 2 || !source || !from || !to) {
    throw new Error(`Bad input line "${line}". Expected: <source> HH:MM-HH:MM`);
  }
  const start = parseClock(from, line);
  let end = parseClock(to, line);
  if (end === start) throw new Error(`Session "${line}" starts and ends at the same time`);
  if (end < start) end += MINUTES_PER_DAY;
  return { source, start: isoAt(start), end: isoAt(end) };
}
 
export function parseScenario(text: string): ParsedScenario {
  const lines = normalizeText(text).split('\n');
 
  const titleLine = lines[0] ?? '';
  if (!titleLine.startsWith('# ')) {
    throw new Error('A scenario must start with a "# Title" line');
  }
 
  const input = sectionLines(lines, '## Input');
  if (!input || input.length === 0) {
    throw new Error('A scenario needs an "## Input" section with at least one session');
  }
 
  const result = sectionLines(lines, '## Result');
  if (!result) {
    throw new Error('A scenario needs a "## Result" section: without expected output it is not a test');
  }
  for (const key of RESULT_KEYS) {
    if (!result.some((line) => line.startsWith(`${key}: `))) {
      throw new Error(`The "## Result" section is missing a "${key}: ..." line`);
    }
  }
 
  return {
    title: titleLine.slice(2).trim(),
    inputLines: input,
    sessions: input.map(parseSessionLine),
  };
}
 
function pad(value: number): string {
  return String(value).padStart(2, '0');
}
 
function clockAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`mergeSleep returned an invalid timestamp: "${iso}"`);
  }
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}
 
/** Build the full scenario text from the parsed input and the ACTUAL result of the code. */
export function renderScenario(scenario: ParsedScenario, result: MergeResult): string {
  const sessions =
    result.sessions.length === 0
      ? 'none'
      : result.sessions.map((session) => `${clockAt(session.start)}-${clockAt(session.end)}`).join(', ');
 
  return [
    `# ${scenario.title}`,
    '',
    '## Input',
    ...scenario.inputLines,
    '',
    '## Result',
    `sessions: ${sessions}`,
    `total_minutes: ${result.totalMinutes}`,
    `overlaps_merged: ${result.overlapsMerged}`,
    '',
  ].join('\n');
}