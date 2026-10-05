import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mergeSleep } from '../src/mergeSleep';
import { normalizeText, parseScenario, renderScenario } from './support/scenarioFormat';
 
// THE runner. It is written once and reviewed closely. After that, a new test case is a new
// .approved.md file in scenarios/, and nothing in this file changes.
const scenariosDir = fileURLToPath(new URL('../scenarios/', import.meta.url));
const files = readdirSync(scenariosDir)
  .filter((name) => name.endsWith('.approved.md'))
  .sort();
 
describe('approved scenarios', () => {
  it('finds at least one scenario', () => {
    expect(files.length).toBeGreaterThan(0);
  });
 
  it.each(files)('%s', (file) => {
    const text = readFileSync(`${scenariosDir}${file}`, 'utf8');
 
    // 1. Parse the file. This throws if it has no expected output.
    const scenario = parseScenario(text);
 
    // 2. Run the code with the file's input.
    const result = mergeSleep(scenario.sessions);
 
    // 3. Rebuild the whole file from the ACTUAL result, then compare it to the approved file.
    //    This is the only assertion, so a failure shows every wrong line at once.
    expect(renderScenario(scenario, result)).toBe(normalizeText(text));
  });
});