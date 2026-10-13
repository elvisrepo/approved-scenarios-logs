import { logMerge } from './build/logMerge.js';
import { normalizeLog, parseLog, renderLog } from './build/fmt/tests/support/logFormat.js';

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function initLogs(highlight) {
  let approvedText;
  let recordings = [];
  let selectedRecording;
  let workingText;
  let mode = 'approved';
  let capturedLines;
  let capturedText;
  let preferredWidth;
  try { preferredWidth = Number(localStorage.getItem('sleep-merger.logs-runner-width')) || undefined; } catch {}

  function updateWidth() {
    if ($('tab-logs').hidden) return;
    const narrow = matchMedia('(max-width: 700px)').matches;
    const max = Math.max(280, Math.min(620, Math.floor(($('tab-logs').clientWidth - 384) / 10) * 10));
    const width = Math.min(max, Math.max(280, preferredWidth ?? (innerWidth <= 1100 ? 280 : 330)));
    $('logs-runner-width').max = String(max);
    $('logs-runner-width').value = String(width);
    $('logs-width-value').value = `${width} px`;
    $('logs-runner-width').disabled = narrow;
    $('tab-logs').style.setProperty('--runner-width', `${width}px`);
    const offset = narrow ? Math.ceil($('logs-loop-wrap').getBoundingClientRect().height) + 16 : 12;
    $('tab-logs').style.setProperty('--runner-offset', `${offset}px`);
    document.documentElement.style.setProperty('--logs-runner-offset', `${offset}px`);
  }
  $('logs-runner-width').addEventListener('input', () => {
    preferredWidth = Number($('logs-runner-width').value);
    try { localStorage.setItem('sleep-merger.logs-runner-width', String(preferredWidth)); } catch {}
    updateWidth();
  });
  window.addEventListener('resize', updateWidth);
  new ResizeObserver(updateWidth).observe($('logs-loop-wrap'));

  function selectNode(id, step) {
    $('logs-runner-graph').querySelectorAll('[data-log-node]').forEach((node) => {
      const selected = node.dataset.logNode === id;
      node.toggleAttribute('data-demo-selected', selected);
      node.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('[data-log-step]').forEach((button) => {
      if (button.dataset.logStep === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }
  function clearHighlights() {
    $('tab-logs').querySelectorAll('.runner-target, .runner-context').forEach((target) => target.classList.remove('runner-target', 'runner-context'));
  }
  function reveal(id, contextId, node, step) {
    const target = $(id);
    for (let parent = target.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
    clearHighlights();
    selectNode(node, step);
    target.classList.add('runner-target');
    const context = $(contextId);
    context.classList.add('runner-context');
    if (!target.matches('button, [tabindex]')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    updateWidth();
    if (id === 'logs-experiment') {
      const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 88;
      window.scrollTo({ top: Math.max(0, context.getBoundingClientRect().top + scrollY - padding, target.getBoundingClientRect().bottom + scrollY - innerHeight + 24) });
    } else context.scrollIntoView({ block: 'start' });
  }

  function eventTone(event, index) {
    if (event.event === 'merge_requested') return 'request';
    if (event.event === 'merge_completed') return 'summary';
    return index % 2 === 1 ? 'merge-purple' : 'merge-amber';
  }
  function eventCards(text, matchedColors = false) {
    return normalizeLog(text).trimEnd().split('\n').map((line, index) => {
      const event = JSON.parse(line);
      let title, detail;
      if (event.event === 'merge_requested') {
        title = 'Recorded request';
        detail = `<ul class="session-list">${event.sessions.map((s) => `<li><strong>${esc(s.source)}</strong><span>${esc(s.start.slice(11, 16))}–${esc(s.end.slice(11, 16))} UTC</span></li>`).join('')}</ul>`;
      } else if (event.event === 'session_merged') {
        title = 'Merged session';
        detail = `<p>${esc(event.start.slice(11, 16))}–${esc(event.end.slice(11, 16))} UTC <span class="muted">· ${esc(event.start.slice(0, 10))} → ${esc(event.end.slice(0, 10))}</span></p>`;
      } else {
        title = 'Merge completed';
        detail = `<p><strong>${esc(event.totalMinutes)} minutes</strong> · ${esc(event.overlapsMerged)} overlap${event.overlapsMerged === 1 ? '' : 's'} merged</p>`;
      }
      const tone = matchedColors ? ` data-event-tone="${eventTone(event, index)}" data-event-index="${index}"` : '';
      return `<article class="event-card"${tone}><div class="event-heading"><span class="event-number">${index + 1}</span><h3>${title}</h3><code>${esc(event.event)}</code></div>${detail}</article>`;
    }).join('');
  }
  function updateTraditionalTest() {
    try {
      const input = parseLog(workingText).sessions;
      const events = normalizeLog(workingText).trimEnd().split('\n').map((line) => JSON.parse(line));
      const indent = (text, prefix) => text.split('\n').map((line) => prefix + line).join('\n');
      const expected = events.map((event) => `    JSON.stringify(${JSON.stringify(event, null, 2).replace(/\n/g, '\n    ')}),`).join('\n');
      const code = `it(${JSON.stringify(`replays ${selectedRecording.name}`)}, () => {\n  const sessions =\n${indent(JSON.stringify(input, null, 2), '    ')};\n\n  expect(logMerge(sessions)).toEqual([\n${expected}\n  ]);\n});`;
      $('logs-test-code').innerHTML = highlight(code);
      $('logs-test-note').textContent = mode === 'wrong-total' ? 'These assertions contain the same incorrect total as the browser expectation.' : selectedRecording.id === 'exact-duplicate' ? 'The input and expected JSON lines come from the approved recording, independently of the replay.' : 'This demo recording uses the approved scenario’s input and expected result. Its expected events are stored independently of the replay.';
    } catch {
      $('logs-test-code').textContent = 'An invocation is required to build a replay test. Restore the recording to recover its input and assertions.';
      $('logs-test-note').textContent = 'A log without the request input cannot become a replayable regression test.';
    }
  }
  function updateRecording() {
    $('logs-recorded-raw').textContent = workingText;
    $('logs-recorded-events').innerHTML = eventCards(workingText);
    $('logs-expected').textContent = workingText;
    $('logs-expected-label').textContent = mode === 'approved' ? selectedRecording.id === 'exact-duplicate' ? 'Expected · approved log' : 'Expected · scenario-derived recording' : 'Expected · modified browser copy';
    $('logs-restore').hidden = mode === 'approved';
    $('logs-wrong-total').disabled = mode === 'wrong-total';
    $('logs-remove-invocation').disabled = mode === 'missing-invocation';
    updateTraditionalTest();
  }
  function clearReplay() {
    capturedLines = undefined;
    capturedText = undefined;
    $('logs-replayed-events').innerHTML = '<p class="empty-result">Replay the recording to capture its events.</p>';
    $('logs-captured-raw').textContent = 'No events captured yet.';
    $('logs-actual').textContent = 'Capture the replayed events to rebuild the actual log.';
    $('logs-capture-status').textContent = 'Not replayed yet';
    $('logs-capture-status').className = 'badge subtle';
    $('logs-comparison-status').textContent = 'Not replayed yet';
    $('logs-comparison-status').className = 'badge subtle';
    $('logs-expected').textContent = workingText;
  }
  function readInvocation() {
    clearReplay();
    try {
      const parsed = parseLog(workingText);
      $('logs-input').textContent = JSON.stringify(parsed.sessions, null, 2);
      $('logs-parse-status').textContent = `✓ Valid · ${parsed.sessions.length} sessions`;
      $('logs-parse-status').className = 'badge pass';
      $('logs-comparison-message').textContent = 'Invocation read. Replay these sessions through logMerge.';
      return parsed;
    } catch (error) {
      $('logs-input').textContent = `Rejected before execution: ${error.message}`;
      $('logs-parse-status').textContent = '✗ Missing invocation';
      $('logs-parse-status').className = 'badge fail';
      $('logs-capture-status').textContent = 'Not executed';
      $('logs-comparison-status').textContent = '✗ REJECTED · no invocation';
      $('logs-comparison-status').className = 'badge fail';
      $('logs-actual').textContent = 'No replay was executed. The log must begin with merge_requested and its input sessions.';
      $('logs-comparison-message').textContent = 'Replay rejected before execution. The remaining events describe output but do not supply the input needed to reproduce it.';
      $('logs-lesson-message').textContent = 'The invocation was removed. No function ran and no events were captured. Restore the recording to make this recording replayable again.';
      return undefined;
    }
  }
  function replay() {
    const invocation = readInvocation();
    if (!invocation) return false;
    capturedLines = logMerge(invocation.sessions);
    $('logs-replayed-events').innerHTML = eventCards(renderLog(capturedLines), true);
    $('logs-captured-raw').innerHTML = capturedLines.map((line, index) => `<span class="event-json-line" data-event-tone="${eventTone(JSON.parse(line), index)}" data-event-index="${index}">${esc(line)}</span>`).join('\n') + '\n';
    $('logs-capture-status').textContent = `${capturedLines.length} events captured`;
    $('logs-capture-status').className = 'badge pass';
    $('logs-comparison-status').textContent = 'Not compared yet';
    $('logs-comparison-message').textContent = 'Replay complete. Capture events rebuilds the log for the full comparison.';
    return true;
  }
  function capture() {
    if (!capturedLines && !replay()) return false;
    capturedText = renderLog(capturedLines);
    $('logs-expected').textContent = workingText;
    $('logs-actual').textContent = capturedText;
    $('logs-comparison-status').textContent = 'Not compared yet';
    $('logs-comparison-status').className = 'badge subtle';
    $('logs-comparison-message').textContent = 'Captured events rebuilt as JSON lines. Compare the full log to check values and order.';
    return true;
  }
  function compare() {
    // Always replay the current browser copy: a previous successful capture
    // must never mask a subsequently missing invocation.
    if (!replay() || !capture()) return undefined;
    const expected = normalizeLog(workingText);
    const matches = expected === capturedText;
    const left = expected.trimEnd().split('\n');
    const right = capturedText.trimEnd().split('\n');
    const count = Math.max(left.length, right.length);
    const pane = (lines, className) => Array.from({ length: count }, (_, i) => left[i] === right[i] ? esc(lines[i] ?? '') : `<span class="${className}">${esc(lines[i] ?? '')}</span>`).join('\n');
    $('logs-expected').innerHTML = pane(left, 'hl-del');
    $('logs-actual').innerHTML = pane(right, 'hl-add');
    $('logs-comparison-status').textContent = matches ? '✓ PASS · all events match' : '✗ FAIL · recording differs';
    $('logs-comparison-status').className = `badge ${matches ? 'pass' : 'fail'}`;
    const actualTotal = JSON.parse(capturedLines.at(-1)).totalMinutes;
    const expectedTotal = JSON.parse(left.at(-1)).totalMinutes;
    $('logs-comparison-message').textContent = matches ? 'Every event and its position matches the selected recording.' : `The replay returns ${actualTotal} minutes. The browser expectation says ${expectedTotal}; the full-log comparison catches the difference.`;
    $('logs-lesson-message').textContent = matches ? 'The recording passes. Try an incorrect total to see a mismatch, or remove its invocation to see replay rejected.' : `This scenario expects ${actualTotal} minutes of sleep. Changing its recorded total to ${expectedTotal} makes the comparison fail. Restore the recording to pass again.`;
    updateTraditionalTest();
    return matches;
  }
  function showExperiment() {
    reveal('logs-experiment', 'logs-compare-stage', 'decide', 'review');
  }
  function runNode(id) {
    if (!approvedText) { $('logs-runner-message').textContent = 'Wait for the recording to load.'; return; }
    const actions = {
      fixture: () => reveal('logs-recorded-raw', 'logs-recording', id, 'input'),
      parse: () => { readInvocation(); reveal('logs-input', 'logs-invocation-details', id, 'input'); },
      execute: () => { if (replay()) reveal('logs-replayed-events', 'logs-replay-stage', id, 'run'); else reveal('logs-input', 'logs-invocation-details', 'parse', 'input'); },
      render: () => { if (capture()) reveal('logs-actual', 'logs-compare-stage', id, 'compare'); else reveal('logs-input', 'logs-invocation-details', 'parse', 'input'); },
      compare: () => { compare(); reveal('logs-comparison-full', 'logs-compare-stage', id, 'compare'); },
      pass: () => { if (compare() === true) reveal('logs-comparison-status', 'logs-compare-stage', id, 'compare'); else showExperiment(); },
      decide: () => { compare(); showExperiment(); },
    };
    $('logs-runner-message').textContent = {
      fixture: 'The selected recording contains the invocation and expected events.',
      parse: 'Read the first event to recover the input needed for replay.',
      execute: 'Replay the recorded request through the real logMerge function.',
      render: 'Rebuild the log from newly captured events.',
      compare: 'Compare every JSON line in its recorded order.',
      pass: 'Verify the replay against the selected recording.',
      decide: 'Explore a mismatch or missing input, then restore the recording.',
    }[id];
    actions[id]?.();
  }
  $('logs-runner-graph').addEventListener('click', (event) => {
    const node = event.target.closest('[data-log-node]');
    if (node) { event.preventDefault(); runNode(node.dataset.logNode); }
  });
  $('logs-runner-graph').addEventListener('keydown', (event) => {
    const node = event.target.closest('[data-log-node]');
    if (node && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); runNode(node.dataset.logNode); }
  });
  document.querySelectorAll('[data-log-step]').forEach((button) => button.addEventListener('click', () => runNode({ input: 'fixture', run: 'execute', compare: 'compare', review: 'decide' }[button.dataset.logStep])));
  $('logs-clear-highlight').addEventListener('click', () => { clearHighlights(); selectNode(null, 'input'); $('logs-runner-message').textContent = 'Choose a step to explore the recording and its replay.'; });
  $('logs-replay').addEventListener('click', () => { compare(); reveal('logs-comparison-full', 'logs-compare-stage', 'compare', 'compare'); });
  $('logs-wrong-total').addEventListener('click', () => {
    mode = 'wrong-total';
    const events = approvedText.trimEnd().split('\n').map((line) => JSON.parse(line));
    events.at(-1).totalMinutes *= 2;
    workingText = renderLog(events.map((event) => JSON.stringify(event)));
    updateRecording(); compare(); showExperiment();
  });
  $('logs-remove-invocation').addEventListener('click', () => {
    mode = 'missing-invocation';
    workingText = renderLog(approvedText.trimEnd().split('\n').slice(1));
    updateRecording(); compare(); showExperiment();
  });
  $('logs-restore').addEventListener('click', () => { mode = 'approved'; workingText = approvedText; updateRecording(); compare(); showExperiment(); });
  function reset() {
    mode = 'approved'; workingText = approvedText;
    clearReplay(); updateRecording(); clearHighlights(); selectNode(null, 'input');
    $('logs-input').textContent = 'Choose Read invocation to inspect the replay input.';
    $('logs-parse-status').textContent = 'Not read yet'; $('logs-parse-status').className = 'badge subtle';
    $('logs-comparison-message').textContent = 'Replay the invocation, capture its events, and compare the complete log.';
    $('logs-lesson-message').textContent = 'Try an incorrect total, or remove the invocation to see why replay needs its input.';
    $('logs-runner-message').textContent = 'A reviewed recording becomes a replayable regression test.';
  }
  function chooseRecording(id) {
    selectedRecording = recordings.find((recording) => recording.id === id);
    approvedText = renderLog(selectedRecording.lines);
    $('logs-scenario').value = id;
    $('logs-recording-title').textContent = selectedRecording.name;
    $('logs-recording-badge').textContent = id === 'exact-duplicate' ? 'Approved log' : 'Demo recording';
    $('logs-recording-source').textContent = id === 'exact-duplicate' ? 'logs/exact-duplicate.approved.log' : `Demo recording based on ${selectedRecording.source}. Expected events come from the approved result.`;
    reset();
  }
  $('logs-scenario').addEventListener('change', () => chooseRecording($('logs-scenario').value));
  $('logs-reset').addEventListener('click', () => {
    chooseRecording('chain-of-three'); $('tab-logs').querySelectorAll('details').forEach((details) => { details.open = true; });
    $('logs-reset').focus({ preventScroll: true }); $('logs-recording').scrollIntoView({ block: 'start' });
  });
  try {
    const [response, catalog] = await Promise.all([fetch('../logs/exact-duplicate.approved.log'), fetch('./log-recordings.json?v=logs-event-colors-1')]);
    if (!response.ok || !catalog.ok) throw new Error('Could not load the log recordings.');
    recordings = await catalog.json();
    recordings.find((recording) => recording.id === 'exact-duplicate').lines = normalizeLog(await response.text()).trimEnd().split('\n');
    recordings.forEach((recording) => parseLog(renderLog(recording.lines)));
    $('logs-scenario').innerHTML = recordings.map((recording) => `<option value="${esc(recording.id)}">${esc(recording.name)}</option>`).join('');
    chooseRecording('chain-of-three');
    $('logs-scenario').disabled = false;
    $('logs-replay').disabled = false; $('logs-reset').disabled = false;
  } catch (error) {
    $('logs-load-error').hidden = false;
    $('logs-load-error').textContent = error.message;
  }
}
