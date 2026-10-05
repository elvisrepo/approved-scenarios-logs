import { describe, expect, it } from 'vitest';
import { normalizeText, parseScenario, renderScenario } from './support/scenarioFormat';
 
// These tests check the scenario format itself (the parser and the renderer),
// not mergeSleep. They are the "validate the runner once" part of the pattern.
 
const VALID = `# Partial overlap becomes the union
 
## Input
fitbit  22:00-06:00
phone   22:30-06:30
 
## Result
sessions: 22:00-06:30
total_minutes: 510
overlaps_merged: 1
`;
 
describe('scenario format', () => {
  it('turns input lines into UTC sessions, crossing midnight when needed', () => {
    expect(parseScenario(VALID).sessions).toEqual([
      { source: 'fitbit', start: '2026-10-01T22:00:00Z', end: '2026-10-02T06:00:00Z' },
      { source: 'phone', start: '2026-10-01T22:30:00Z', end: '2026-10-02T06:30:00Z' },
    ]);
  });
 
  it('places times before 18:00 on the next day', () => {
    const nap = VALID.replace('phone   22:30-06:30', 'phone   14:00-14:45');
    expect(parseScenario(nap).sessions[1]).toEqual({
      source: 'phone',
      start: '2026-10-02T14:00:00Z',
      end: '2026-10-02T14:45:00Z',
    });
  });
 
  it('renders an actual result back into the approved text', () => {
    const text = renderScenario(parseScenario(VALID), {
      sessions: [{ start: '2026-10-01T22:00:00Z', end: '2026-10-02T06:30:00Z' }],
      totalMinutes: 510,
      overlapsMerged: 1,
    });
    expect(text).toBe(normalizeText(VALID));
  });
 
  it('rejects a scenario without a Result section', () => {
    const withoutResult = VALID.slice(0, VALID.indexOf('## Result'));
    expect(() => parseScenario(withoutResult)).toThrow(/## Result/);
  });
 
  it('rejects a Result section that is missing a required line', () => {
    const missingLine = VALID.replace('total_minutes: 510\n', '');
    expect(() => parseScenario(missingLine)).toThrow(/total_minutes/);
  });
 
  it('rejects a malformed input line', () => {
    const bad = VALID.replace('phone   22:30-06:30', 'phone   22:30');
    expect(() => parseScenario(bad)).toThrow(/Bad input line/);
  });
});