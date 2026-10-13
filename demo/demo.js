import { initLogs } from './logs.js?v=logs-scenarios-2';
import { mergeSleep } from './build/mergeSleep.js';
import { logMerge } from './build/logMerge.js';
import { normalizeText, parseScenario, renderScenario } from './build/fmt/tests/support/scenarioFormat.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clock = (iso) => iso.slice(11, 16);
const duration = (minutes) => `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
const colors = ['#7483bd', '#3091a5', '#b07b3c'];
const examples = [
  { file: 'exact-duplicate.approved.md', name: 'Same night, two devices', description: 'Two devices report the same eight hours. Count them once.', reason: 'Two reports of the same night are evidence of one sleep block. Adding their durations would count every minute twice.', changes: [['sessions: 22:00-06:00', 'sessions: 22:00-06:00, 22:00-06:00'], ['total_minutes: 480', 'total_minutes: 960'], ['overlaps_merged: 1', 'overlaps_merged: 0']] },
  { file: 'partial-overlap.approved.md', name: 'Partly overlapping records', description: 'The phone starts later and ends later. The result covers both records.', reason: 'The shared period is counted once. The union runs from 22:00 to 06:30: 510 minutes, rather than the 960-minute sum of both records.', changes: [['sessions: 22:00-06:30', 'sessions: 22:00-06:00, 22:30-06:30'], ['total_minutes: 510', 'total_minutes: 960'], ['overlaps_merged: 1', 'overlaps_merged: 0']] },
  { file: 'contained-session.approved.md', name: 'One record inside another', description: 'A shorter phone record sits entirely inside the Fitbit record.', reason: 'The shorter record adds no new minutes. It is absorbed into the outer block, leaving 480 minutes of sleep and one overlap merged.', changes: [['sessions: 22:00-06:00', 'sessions: 22:00-06:00, 23:00-02:00'], ['total_minutes: 480', 'total_minutes: 660'], ['overlaps_merged: 1', 'overlaps_merged: 0']] },
  { file: 'touching-sessions.approved.md', name: 'Touching is not overlapping', description: 'One record ends exactly when the next starts. They share no minutes.', reason: 'The boundary at 23:00 is a shared instant, not shared sleep time. The blocks stay separate and no overlap is counted.', changes: [['sessions: 22:00-23:00, 23:00-00:00', 'sessions: 22:00-00:00'], ['overlaps_merged: 0', 'overlaps_merged: 1']] },
  { file: 'chain-of-three.approved.md', name: 'A chain of three overlaps', description: 'Three overlapping records connect into one continuous night.', reason: 'Adding the three input durations gives 420 minutes and double-counts shared time. Their union runs from 22:00 to 04:00: 360 minutes.', changes: [['total_minutes: 360', 'total_minutes: 420']] },
  { file: 'separate-sessions.approved.md', name: 'Night sleep and a daytime nap', description: 'Separate records stay separate and return in time order.', reason: 'Results are sorted by actual start time. The 23:00 night comes before the 14:00 nap on the next day, even though the nap was listed first.', changes: [['sessions: 23:00-07:00, 14:00-14:45', 'sessions: 14:00-14:45, 23:00-07:00']] },
];
const byFile = new Map(examples.map((item) => [item.file, item]));
const approved = new Map();
const defaultExampleFile = 'chain-of-three.approved.md';
const breakText = (text, file) => byFile.get(file).changes.reduce((copy, [correct, wrong]) => copy.replace(correct, wrong), text);
async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  return response.text();
}

// Native buttons plus the standard arrow/Home/End tab navigation.
const tabs = [...document.querySelectorAll('[role="tab"]')];
function activateTab(button, focus = false) {
  tabs.forEach((tab) => {
    const active = tab === button;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    $(`tab-${tab.dataset.tab}`).hidden = !active;
  });
  if (button.dataset.tab === 'demo') updateRunnerWidth();
  if (button.dataset.tab === 'logs') window.dispatchEvent(new Event('resize'));
  if (focus) button.focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); activateTab(tabs[next], true); }
  });
});

let selectedRunnerNode = null;
function focusLoop(node) {
  selectedRunnerNode = node;
  const svg = $('runner-graph');
  if (!svg) return;
  svg.querySelectorAll('[data-node-id]').forEach((element) => {
    const selected = element.dataset.nodeId === node;
    element.toggleAttribute('data-demo-selected', selected);
    element.setAttribute('aria-pressed', String(selected));
  });
}
function clearTargetHighlight() {
  document.querySelectorAll('.runner-target, .runner-context').forEach((target) => target.classList.remove('runner-target', 'runner-context'));
}
$('loop-reset').addEventListener('click', () => {
  focusLoop(null);
  clearTargetHighlight();
  $('runner-message').textContent = 'Click a step to explore its content. All paths remain visible.';
});
// Keep the step bar and scroll targets below the pinned, responsive diagram.
function updateRunnerOffset() {
  document.documentElement.style.setProperty('--runner-offset', `${window.matchMedia('(max-width: 700px)').matches ? Math.ceil($('loop-wrap').getBoundingClientRect().height) + 16 : 12}px`);
}
new ResizeObserver(updateRunnerOffset).observe($('loop-wrap'));
window.addEventListener('resize', updateRunnerOffset);
// Preserve the requested width while fitting the current desktop viewport.
let preferredRunnerWidth;
try { preferredRunnerWidth = Number(localStorage.getItem('sleep-merger.runner-width')) || undefined; } catch {}
function updateRunnerWidth() {
  const slider = $('runner-width');
  const narrow = window.matchMedia('(max-width: 700px)').matches;
  const available = $('tab-demo').clientWidth;
  const max = Math.max(280, Math.min(620, Math.floor((available - 384) / 10) * 10));
  slider.max = String(max);
  const initial = innerWidth <= 1100 ? 280 : Math.min(370, Math.max(300, Math.round(innerWidth * .23 / 10) * 10));
  const width = Math.min(max, Math.max(280, preferredRunnerWidth ?? initial));
  slider.value = String(width);
  $('runner-width-value').value = `${width} px`;
  $('tab-demo').style.setProperty('--runner-width', `${width}px`);
  slider.disabled = narrow;
  updateRunnerOffset();
}
$('runner-width').addEventListener('input', () => {
  preferredRunnerWidth = Number($('runner-width').value);
  try { localStorage.setItem('sleep-merger.runner-width', String(preferredRunnerWidth)); } catch {}
  updateRunnerWidth();
});
window.addEventListener('resize', updateRunnerWidth);
updateRunnerWidth();
const stepDescriptions = { input: 'Start with an approved example.', run: 'Run the pure merging function.', compare: 'Compare the whole result with the expectation.', review: 'Read the mismatch and review the expectation.' };
function setStep(step, node = { input: 'fixture', run: 'execute', compare: 'compare', review: 'decide' }[step]) {
  document.querySelectorAll('[data-step]').forEach((button) => {
    if (button.dataset.step === step) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  $('step-help').textContent = stepDescriptions[step];
  focusLoop(node);
}
// Scroll the content's context into view while retaining focus on its exact target.
const runnerContexts = {
  'demo-file': 'stage-file',
  'parsed-input': 'parsed-details',
  'result-summary': 'stage-run',
  'rendered-actual': 'stage-compare',
  'comparison-full': 'stage-compare',
  'comparison-status': 'stage-compare',
  'stage-experiment': 'stage-compare',
  'restore-expectation': 'stage-compare',
};
function revealTarget(id, step, node) {
  const target = $(id);
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.open = true;
  }
  setStep(step, node);
  clearTargetHighlight();
  target.classList.add('runner-target');
  if (!target.matches('button, select, input, textarea, a[href], [tabindex]')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
  updateRunnerOffset();
  const context = $(runnerContexts[id]) || target.closest('details, section') || target;
  context.classList.add('runner-context');
  if (id === 'stage-experiment' || id === 'restore-expectation') {
    // Keep the evidence above the decision controls, and bring the whole
    // experiment into view when it would extend past the viewport.
    const panel = $('stage-experiment');
    const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 88;
    const top = Math.max(0, context.getBoundingClientRect().top + scrollY - padding, panel.getBoundingClientRect().bottom + scrollY - innerHeight + 24);
    window.scrollTo({ top });
  } else context.scrollIntoView({ block: 'start' });
}
function visitStep(step) {
  clearTargetHighlight();
  setStep(step);
  const target = step === 'input' ? $('preset-pick') : step === 'run' ? $('merge') : step === 'review' ? $('experiment-title') : $('compare-title');
  target.tabIndex = target.tagName === 'H2' ? -1 : target.tabIndex;
  target.focus({ preventScroll: true });
  (step === 'input' ? $('stage-file') : step === 'run' ? $('stage-run') : step === 'review' ? $('stage-experiment') : $('stage-compare')).scrollIntoView({ block: 'start' });
}
document.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => visitStep(button.dataset.step)));

let currentExample = byFile.get(defaultExampleFile);
let currentScenario;
let currentResult;
let expectationBroken = false;
function rangeText(session) {
  const overnight = session.start.slice(0, 10) !== session.end.slice(0, 10);
  return `${clock(session.start)}–${clock(session.end)}${overnight ? ' (+1 day)' : ''}`;
}
// All rows share one UTC axis; the full range includes the following day's nap.
function renderTimeline() {
  const sessions = currentScenario.sessions;
  const hour = 3_600_000;
  const start = Math.floor(Math.min(...sessions.map((s) => Date.parse(s.start))) / hour) * hour;
  const end = Math.ceil(Math.max(...sessions.map((s) => Date.parse(s.end))) / hour) * hour;
  const position = (ms) => (ms - start) / (end - start) * 100;
  const firstDay = new Date(start).toISOString().slice(0, 10);
  const ticks = Array.from({ length: 5 }, (_, i) => {
    const stamp = new Date(start + (end - start) * i / 4).toISOString();
    return `<span class="tick" style="left:${i * 25}%">${clock(stamp)}<b>${stamp.slice(0, 10) === firstDay ? 'Day 1' : 'Day 2'}</b></span>`;
  }).join('');
  const boundaries = [...new Set(sessions.flatMap((s) => [Date.parse(s.start), Date.parse(s.end)]))].sort((a, b) => a - b);
  const shared = boundaries.slice(0, -1).flatMap((left, i) => {
    const right = boundaries[i + 1];
    return sessions.filter((s) => Date.parse(s.start) <= left && Date.parse(s.end) >= right).length > 1 ? [[left, right]] : [];
  });
  const band = ([left, right]) => `<span class="overlap-band" aria-hidden="true" style="left:${position(left)}%;width:${position(right) - position(left)}%"></span>`;
  const bar = (session, color) => `<span class="sleep-bar" aria-hidden="true" title="${esc(rangeText(session))}" style="--source:${color};left:${position(Date.parse(session.start))}%;width:${position(Date.parse(session.end)) - position(Date.parse(session.start))}%"></span>`;
  const rows = sessions.map((session, i) => `<div class="timeline-row" role="img" aria-label="${esc(session.source)}: ${esc(rangeText(session))}"><span class="timeline-label" aria-hidden="true">${esc(session.source)}</span><div class="track" aria-hidden="true">${shared.map(band).join('')}${bar(session, colors[i % colors.length])}</div></div>`).join('');
  const resultDescription = currentResult ? currentResult.sessions.map(rangeText).join(', ') : 'Run the example to see the result';
  $('timeline').innerHTML = `<div class="axis" aria-hidden="true">${ticks}</div>${rows}<div class="timeline-row result-row" role="img" aria-label="Merged result: ${esc(resultDescription)}"><span class="timeline-label" aria-hidden="true">Result</span><div class="track" aria-hidden="true">${currentResult ? currentResult.sessions.map((s) => bar(s, '#096c65')).join('') : '<span class="track-placeholder">Waiting for a run</span>'}</div></div>`;
  $('timeline-note').textContent = currentResult ? `Result: ${resultDescription}. Times are UTC.` : 'Day 2 is the following day. Striped areas show time covered by more than one source.';
}

function fullDiff(expected, actual) {
  const left = normalizeText(expected).split('\n');
  const right = normalizeText(actual).split('\n');
  const count = Math.max(left.length, right.length);
  const pane = (lines, className) => Array.from({ length: count }, (_, i) => left[i] === right[i] ? esc(lines[i] ?? '') : `<span class="${className}">${esc(lines[i] ?? '')}</span>`).join('\n');
  return `<div class="diff2"><div><h3>Expected · browser copy</h3><pre>${pane(left, 'hl-del')}</pre></div><div><h3>Actual · function output</h3><pre>${pane(right, 'hl-add')}</pre></div></div>`;
}
const outputFields = [['sessions', 'Sleep blocks'], ['total_minutes', 'Minutes asleep'], ['overlaps_merged', 'Overlaps merged']];
function fieldValue(text, key) { return text.split('\n').find((line) => line.startsWith(`${key}: `))?.slice(key.length + 2) ?? 'Missing expectation'; }
function comparisonTable(expected, actual) {
  return `<table class="comparison-table"><caption class="sr-only">Expected and actual merge outputs</caption><thead><tr><th scope="col">Output</th><th scope="col">Expected</th><th scope="col">Actual</th></tr></thead><tbody>${outputFields.map(([key, label]) => {
    const a = fieldValue(expected, key), b = fieldValue(actual, key);
    return `<tr class="${a === b ? '' : 'different'}"><th scope="row">${label}${a === b ? '' : ' · mismatch'}</th><td>${esc(a)}</td><td>${esc(b)}</td></tr>`;
  }).join('')}</tbody></table>`;
}
// Assertions come from the chosen expectation, independently of mergeSleep's
// output. Reuse the scenario parser to expand clock ranges into overnight UTC.
function traditionalTest(scenario, expected) {
  const ranges = fieldValue(expected, 'sessions');
  const expectedSessions = ranges === 'none' ? [] : parseScenario(
    `# Expected blocks\n\n## Input\n${ranges.split(', ').map((range) => `expected ${range}`).join('\n')}\n\n## Result\nsessions: none\ntotal_minutes: 0\noverlaps_merged: 0\n`,
  ).sessions;
  const quote = (value) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const inputs = scenario.sessions.map((session) =>
    `    { source: ${quote(session.source)},\n      start: ${quote(session.start)},\n      end: ${quote(session.end)} },`,
  ).join('\n');
  const outputs = expectedSessions.map((session) =>
    `    { start: ${quote(session.start)},\n      end: ${quote(session.end)} },`,
  ).join('\n');
  return `it(${quote(scenario.title)}, () => {\n  const result = mergeSleep([\n${inputs}\n  ]);\n\n  expect(result.sessions).toEqual([${outputs ? `\n${outputs}\n  ` : ''}]);\n  expect(result.totalMinutes).toBe(${fieldValue(expected, 'total_minutes')});\n  expect(result.overlapsMerged).toBe(${fieldValue(expected, 'overlaps_merged')});\n});`;
}
function showTraditionalTest(expected) {
  $('traditional-test-code').innerHTML = highlight(traditionalTest(currentScenario, expected));
  $('traditional-test-note').textContent = expectationBroken
    ? 'These assertions now contain the same incorrect expectation shown in the comparison.'
    : 'The same input and approved expectations, expressed as assertions.';
}
function selectedExpectation() {
  const original = approved.get(currentExample.file);
  return expectationBroken ? breakText(original, currentExample.file) : original;
}
function validateExample() {
  if (!currentScenario) return false;
  try {
    currentScenario = parseScenario(selectedExpectation());
    $('parsed-input').textContent = JSON.stringify(currentScenario.sessions, null, 2);
    $('parse-status').textContent = `✓ Valid · ${currentScenario.sessions.length} sessions`;
    $('parse-status').className = 'badge pass';
    return true;
  } catch (error) {
    $('parsed-input').textContent = `Rejected before execution: ${error.message}`;
    $('parse-status').textContent = '✗ Invalid format';
    $('parse-status').className = 'badge fail';
    return false;
  }
}
function displayMarkdown(actual, compared = false) {
  const expected = selectedExpectation();
  const expectedPane = $('expected-markdown');
  const actualPane = $('rendered-actual');
  expectedPane.previousElementSibling.textContent = expectationBroken ? 'Expected · modified browser copy' : 'Expected · approved file';
  if (!compared) {
    expectedPane.textContent = normalizeText(expected);
    actualPane.textContent = actual;
    return;
  }
  const left = normalizeText(expected).split('\n');
  const right = normalizeText(actual).split('\n');
  const count = Math.max(left.length, right.length);
  const pane = (lines, className) => Array.from({ length: count }, (_, i) => left[i] === right[i] ? esc(lines[i] ?? '') : `<span class="${className}">${esc(lines[i] ?? '')}</span>`).join('\n');
  expectedPane.innerHTML = pane(left, 'hl-del');
  actualPane.innerHTML = pane(right, 'hl-add');
}
function resetComparison(message, actualPlaceholder) {
  displayMarkdown(actualPlaceholder);
  $('comparison').hidden = true;
  $('comparison').innerHTML = '';
  $('comparison-empty').hidden = false;
  $('comparison-empty').textContent = 'Diff file vs actual checks every line and highlights differences.';
  $('comparison-status').textContent = 'Not compared yet';
  $('comparison-status').className = 'badge subtle';
  $('comparison-message').textContent = message;
  $('try-mistake').disabled = true;
  $('restore-expectation').hidden = !expectationBroken;
  $('lesson-message').textContent = 'Compare the example first, then try an incorrect expectation to see the test fail.';
}
function renderActual() {
  if (!currentResult && !executeExample()) return undefined;
  const actual = renderScenario(currentScenario, currentResult);
  resetComparison('Actual output rendered. Read it beside the expectation, then choose Diff file vs actual to compare every line.', actual);
  return actual;
}
function showComparison(restored = false) {
  const actual = renderActual();
  if (actual === undefined) return undefined;
  const expected = selectedExpectation();
  const matches = normalizeText(expected) === actual;
  $('comparison-status').textContent = matches ? '✓ PASS · all outputs match' : '✗ FAIL · expectation differs';
  $('comparison-status').className = `badge ${matches ? 'pass' : 'fail'}`;
  $('lesson-message').textContent = matches ? (restored ? `The correct expectation passes again. ${currentExample.reason}` : 'The complete rendered file matches the approved example. Now try an incorrect expectation and watch the test catch it.') : `The test caught the mistake. ${currentExample.reason}`;
  $('comparison').hidden = false;
  $('comparison-empty').hidden = true;
  $('comparison').innerHTML = comparisonTable(expected, actual);
  showTraditionalTest(expected);
  displayMarkdown(actual, true);
  $('comparison-message').textContent = matches ? 'Every line of the expected and actual files matches.' : 'The files differ. Highlighted lines show the mismatches.';
  $('try-mistake').disabled = !matches;
  $('restore-expectation').hidden = !expectationBroken;
  setStep(expectationBroken || restored ? 'review' : 'compare');
  return matches;
}
function selectExample() {
  currentExample = byFile.get($('preset-pick').value);
  currentScenario = parseScenario(approved.get(currentExample.file));
  currentResult = undefined;
  expectationBroken = false;
  $('demo-file').textContent = approved.get(currentExample.file);
  $('scenario-description').textContent = currentExample.description;
  $('list').innerHTML = currentScenario.sessions.map((session, i) => `<li><span class="source-name"><i class="source-dot" style="--source:${colors[i % colors.length]}" aria-hidden="true"></i>${esc(session.source)}</span><span class="session-time">${esc(rangeText(session))}</span></li>`).join('');
  $('merge').disabled = false;
  $('result-empty').hidden = false;
  $('result-summary').hidden = true;
  $('result').textContent = 'Run the example to see the result.';
  $('logs').textContent = 'Run the example to capture the log events.';
  $('parsed-input').textContent = 'Choose Parse and validate to inspect the input.';
  $('parse-status').textContent = 'Not validated yet';
  $('parse-status').className = 'badge subtle';
  resetComparison('The approved expectation is ready. Render the actual output to view both files side by side.', 'Choose Render actual to rebuild the function output as Markdown.');
  $('comparison-status').textContent = 'Not rendered yet';
  clearTargetHighlight();
  $('runner-message').textContent = 'Click a step to explore its content. All paths remain visible.';
  $('sweep-pick').value = currentExample.file;
  showTraditionalTest(approved.get(currentExample.file));
  setStep('input');
  renderTimeline();
}
function executeExample() {
  if (!validateExample()) return false;
  currentResult = mergeSleep(currentScenario.sessions);
  $('total').textContent = duration(currentResult.totalMinutes);
  $('session-count').textContent = currentResult.sessions.length;
  $('session-label').textContent = currentResult.sessions.length === 1 ? 'merged session' : 'merged sessions';
  $('overlaps').textContent = currentResult.overlapsMerged;
  $('overlap-label').textContent = currentResult.overlapsMerged === 1 ? 'overlap merged' : 'overlaps merged';
  $('result').textContent = JSON.stringify(currentResult, null, 2);
  $('logs').textContent = logMerge(currentScenario.sessions).join('\n');
  $('result-empty').hidden = true;
  $('result-summary').hidden = false;
  renderTimeline();
  resetComparison('The merge has run. Render its output to view it beside the selected expectation.', 'Choose Render actual to rebuild this result as Markdown.');
  setStep('run');
  return true;
}
function runExample() {
  if (!executeExample()) return;
  showComparison();
}
$('preset-pick').addEventListener('change', selectExample);
$('merge').addEventListener('click', runExample);
$('try-mistake').addEventListener('click', () => { if (!currentResult) return; expectationBroken = true; showComparison(); $('restore-expectation').focus({ preventScroll: true }); });
$('restore-expectation').addEventListener('click', () => {
  expectationBroken = false;
  if (showComparison(true)) {
    setStep('compare', 'pass');
    $('runner-message').textContent = 'Correct expectation restored. The complete file passes again.';
  }
  $('try-mistake').focus({ preventScroll: true });
});

function runNode(id) {
  if (!currentScenario) {
    $('runner-message').textContent = 'Wait for the selected example to load before exploring its steps.';
    return;
  }
  switch (id) {
    case 'fixture':
      $('runner-message').textContent = 'The selected approved file supplies both input and expected output.';
      revealTarget('demo-file', 'input', id);
      break;
    case 'parse':
      validateExample();
      $('runner-message').textContent = 'Validate the format and inspect the parsed UTC sessions.';
      revealTarget('parsed-input', 'input', id);
      break;
    case 'execute':
      if (!executeExample()) { revealTarget('parsed-input', 'input', 'parse'); break; }
      $('runner-message').textContent = 'Merge complete. Inspect the merged timeline and totals, with JSON and logs below.';
      revealTarget('result-summary', 'run', id);
      break;
    case 'render':
      if (renderActual() === undefined) break;
      $('runner-message').textContent = 'The actual result is rendered into the same Markdown format as the file.';
      revealTarget('rendered-actual', 'compare', id);
      break;
    case 'compare':
      if (showComparison() === undefined) break;
      $('runner-message').textContent = 'Compare the entire expected file with the rendered actual result.';
      revealTarget('comparison-full', 'compare', id);
      break;
    case 'pass': {
      const matches = showComparison();
      if (matches === undefined) break;
      $('runner-message').textContent = matches
        ? 'PASS verified: every line of the expected and actual files matches.'
        : 'This example fails. Review the mismatch before following the PASS branch.';
      revealTarget(matches ? 'comparison-status' : 'stage-experiment', matches ? 'compare' : 'review', matches ? id : 'decide');
      break;
    }
    case 'decide':
      if (showComparison() === undefined) break;
      $('runner-message').textContent = 'Try an incorrect expectation or restore it, then review the comparison.';
      revealTarget('stage-experiment', 'review', id);
      break;
  }
}

// The sidebar graph shares the same actions as the demo's controls.
const runnerGraph = $('runner-graph');
function activateRunnerNode(event) {
  const node = event.target.closest('[data-node-id]');
  if (!node || !runnerGraph.contains(node)) return;
  if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  runNode(node.dataset.nodeId);
}
runnerGraph.addEventListener('click', activateRunnerNode);
runnerGraph.addEventListener('keydown', activateRunnerNode);

// The sweep uses browser copies and the real parser/render/compare loop.
const suiteOverrides = new Map();
function runSweep() {
  let passed = 0;
  let failed = 0;
  $('sweep-out').innerHTML = examples.map((example) => {
    const text = suiteOverrides.get(example.file) ?? approved.get(example.file);
    let actual;
    let error;
    try { const scenario = parseScenario(text); actual = renderScenario(scenario, mergeSleep(scenario.sessions)); }
    catch (caught) { error = caught.message; }
    const matches = !error && actual === normalizeText(text);
    if (matches) passed++; else failed++;
    const heading = `<span class="badge ${matches ? 'pass' : 'fail'}">${matches ? '✓ PASS' : '✗ FAIL'}</span><span class="scenario-label">${esc(example.name)}</span>`;
    return matches ? `<div class="suite-row"><p>${heading}</p></div>` : `<details class="suite-row" open><summary>${heading}</summary><p>${esc(error ?? example.reason)}</p>${error ? '' : comparisonTable(text, actual) + fullDiff(text, actual)}</details>`;
  }).join('');
  $('sweep-status').textContent = `${passed} passed · ${failed} failed · ${examples.length} examples checked`;
  $('sweep-fix').disabled = suiteOverrides.size === 0;
  // The pinned loop follows the selected example. Suite experiments have
  // their own result and restoration controls, without changing that context.
}
$('sweep-run').addEventListener('click', runSweep);
$('sweep-break').addEventListener('click', () => { const file = $('sweep-pick').value; suiteOverrides.set(file, breakText(approved.get(file), file)); runSweep(); });
$('sweep-fix').addEventListener('click', () => { suiteOverrides.clear(); runSweep(); $('sweep-run').focus({ preventScroll: true }); });
$('playground-reset').addEventListener('click', () => {
  $('preset-pick').value = defaultExampleFile;
  suiteOverrides.clear();
  $('sweep-out').replaceChildren();
  $('sweep-status').textContent = 'No suite run yet.';
  $('sweep-fix').disabled = true;
  document.querySelectorAll('#tab-demo details').forEach((details) => { details.open = true; });
  selectExample();
  focusLoop(null);
  $('runner-message').textContent = 'Playground reset. Start with the approved example.';
  $('playground-reset').focus({ preventScroll: true });
  updateRunnerOffset();
  $('stage-file').scrollIntoView({ block: 'start' });
});

// Source files are fetched, so displayed code stays in sync with the project.
const token = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(import|export|from|function|return|const|let|var|if|else|for|of|new|type|interface|extends|satisfies|throws?)\b|\b(number|string|boolean|void|SleepSession|MergedSession|MergeResult|MergeLogEvent)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g;
function highlight(source) {
  let html = '', offset = 0;
  token.lastIndex = 0;
  for (const match of source.matchAll(token)) {
    const [word, comment, string, keyword, type, number] = match;
    html += esc(source.slice(offset, match.index)) + `<span class="tok-${comment ? 'com' : string ? 'str' : keyword ? 'kw' : type ? 'type' : number ? 'num' : 'fn'}">${esc(word)}</span>`;
    offset = match.index + word.length;
  }
  return html + esc(source.slice(offset));
}
async function loadReference(path, id, code = false) {
  try { const text = await fetchText(path); if (code) $(id).innerHTML = highlight(text); else $(id).textContent = text; }
  catch (error) { $(id).textContent = error.message; }
}
Promise.allSettled([
  ...[['types', 'types'], ['mergeSleep', 'merge'], ['logMerge', 'logmerge']].map(([file, id]) => loadReference(`../src/${file}.ts`, `src-${id}`, true)),
  loadReference('../tests/scenarios.test.ts', 'src-runner', true),
]);
initLogs(highlight);
const loaded = await Promise.allSettled(examples.map(async (example) => {
  const text = await fetchText(`../scenarios/${example.file}`);
  parseScenario(text);
  approved.set(example.file, text);
}));
const failure = loaded.find((result) => result.status === 'rejected');
if (failure) {
  $('load-error').hidden = false;
  $('load-error').textContent = `${failure.reason.message} Serve the project root over HTTP, then reload the page.`;
  $('scenario-description').textContent = 'Examples could not be loaded.';
  ['sweep-run', 'sweep-break', 'sweep-pick'].forEach((id) => { $(id).disabled = true; });
} else {
  ['preset-pick', 'sweep-pick'].forEach((id) => {
    $(id).innerHTML = examples.map((example) => `<option value="${example.file}">${esc(example.name)}</option>`).join('');
    $(id).disabled = false;
    $(id).value = defaultExampleFile;
  });
  ['sweep-run', 'sweep-break', 'playground-reset'].forEach((id) => { $(id).disabled = false; });
  selectExample();
  focusLoop(null);
}
