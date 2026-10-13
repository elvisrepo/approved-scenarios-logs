# Sleep Merger — Approved Scenarios & Logs

A small TypeScript practice project for **Approved Scenarios**, **Approved Logs**, and **Constrained Tests**. Explore how reviewed examples and recorded runs become executable specifications, then see a comparison catch a simulated bug.

[Open the demo](https://elvisrepo.github.io/approved-scenarios-logs/demo/)

## What the code does

`mergeSleep(sessions)` combines sleep records from sources such as a Fitbit, phone, and watch. It returns time-ordered, non-overlapping sleep blocks, the total minutes asleep, and the number of overlaps merged. Sessions that touch at a boundary stay separate.

For example, these three records form one continuous night:

```text
fitbit  22:00–00:00
phone   23:30–02:00
watch   01:30–04:00

Result: 22:00–04:00, 360 minutes, 2 overlaps merged
```

`mergeSleep` is pure: no I/O or logging. The separate `logMerge` function returns structured JSON log lines describing the request, merged blocks, and completion summary.

## Explore the demo

**Playground** shows Approved Scenarios. Choose one of six sleep scenarios, follow the vertical runner, inspect the timeline, and compare approved Markdown with the actual rendered result. Simulating a bug changes the actual result while the expected file stays fixed. Restoring correct execution returns the comparison to PASS.

**Logs** shows Approved Logs. Capture a simulated buggy run, recover its invocation, replay the input, capture events, and compare the complete log. In **Review and correct**, enter the expected total and explicitly approve the recording. Approval saves a browser fixture and restores correct replay to demonstrate a fix. The corrected matching lines are highlighted in both panes, and the original buggy evidence stays intact. You can download the reviewed `.approved.log`.

Both views default to **A chain of three overlaps**. Runner nodes reveal and highlight their corresponding content; the left sidebar has an adjustable width. Equivalent traditional test code appears alongside the explanation of each comparison.

The demo simulates implementation bugs and fixes. It does not run a coding agent or change repository files. Browser approvals last until reset or reload; downloaded fixtures do not automatically enter the repository’s test suite.

## Run locally

Use Node.js 24 and npm. Python 3 serves the static demo.

```sh
npm ci
npm run demo:build
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/demo/>. Serve the **project root**, so the page can load the scenarios, logs, source files, and diagram. Rebuild after changing TypeScript sources.

## Run the tests

```sh
npm test
npm run typecheck
```

`npm run test:watch` runs Vitest in watch mode.

| Pattern | Specification | Runner behavior |
| --- | --- | --- |
| Approved Scenarios | `scenarios/*.approved.md`: readable input and expected result | Parse input, call `mergeSleep`, render actual Markdown, and compare the whole file. |
| Approved Logs | `logs/*.approved.log`: invocation followed by expected events | Read the invocation, call `logMerge`, and compare the entire emitted log, including event order. |
| Constrained Tests | Required structure enforced by the fixture parsers | Reject incomplete specifications, such as a scenario without expected result fields or a log without a replayable invocation. |

Comparisons normalize line endings and trailing whitespace. A reviewed fixture added to the appropriate directory becomes another test case without adding a new test function.

The Logs demo offers all six sleep scenarios. The repository currently has one approved log fixture; the other demo recordings use expectations transcribed from the approved scenarios in `demo/log-recordings.json`. Their expected results are stored independently of the implementation being tested.

## Working with approved files

Approved files are the specification. A mismatch is evidence to investigate, not permission to overwrite the expectation with actual output.

For an implementation bug, keep the approved fixture and runner fixed, correct the implementation, and rerun the tests. For a bug discovered in logs, preserve the evidence, review and correct the expected outcome, then approve that corrected recording as a regression fixture.

Agents must follow [AGENTS.md](AGENTS.md): never edit `scenarios/` or `logs/`, ask if an approved file appears wrong, and do not change test runners in the same pass as an implementation fix.

## Project layout

```text
src/          Pure sleep merger and structured log entry point
scenarios/    Approved Markdown specifications
logs/         Approved JSON-line log specifications
tests/        Shared runners and fixture parsers
demo/         Static interactive playground and demo recordings
docs/         Pattern explanations and runner diagram
scripts/      Browser build script
```

## Pattern references

- [Approved Scenarios](https://lexler.github.io/augmented-coding-patterns/patterns/approved-scenarios/): optimize fixtures for easy human validation.
- [Approved Logs](https://lexler.github.io/augmented-coding-patterns/patterns/approved-logs/): turn captured bug evidence into replayable regression tests.
- [Constrained Tests](https://lexler.github.io/augmented-coding-patterns/patterns/constrained-tests/): enforce required inputs and expectations through an external test format.

