import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { logMerge } from '../src/logMerge';
import { normalizeLog, parseLog, renderLog } from './support/logFormat';

// THE logs runner, mirroring the scenarios one: parse line 1 as the
// invocation, replay it through logMerge, and compare every captured line
// against the whole file. A new regression test is a new .approved.log file.
const logsDir = fileURLToPath(new URL('../logs/', import.meta.url));
const files = readdirSync(logsDir)
  .filter((name) => name.endsWith('.approved.log'))
  .sort();

describe('approved logs', () => {
  it('finds at least one log', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s', (file) => {
    const text = readFileSync(`${logsDir}${file}`, 'utf8');

    // 1. Parse line 1. This throws if it has no invocation.
    const log = parseLog(text);

    // 2. Replay the invocation and capture the emitted lines.
    const actual = logMerge(log.sessions);

    // 3. Rebuild the whole file from the ACTUAL lines, then compare.
    expect(renderLog(actual)).toBe(normalizeLog(text));
  });
});
