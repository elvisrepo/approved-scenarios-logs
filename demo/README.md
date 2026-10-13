# Sleep Merger playground

From the project root:

```sh
npm run demo:build
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/demo/>. Serve the project root so the demo can read the approved examples, logs, source files, and runner diagram.

The playground imports the real merging functions and scenario/log parsers from `demo/build/`. Rebuild after changing their TypeScript sources. The page, styles, and interaction code live in `index.html`, `styles.css`, `demo.js`, and `logs.js`.

In Playground, choose an example, run it, simulate a buggy actual result, and restore the correct result.

In Logs, use the vertical runner on the left to inspect a recording, read its invocation, replay the real `logMerge` function, capture events, and compare the complete log. The content on the right includes readable event cards, JSON lines, and an equivalent traditional test. Capture a buggy run, compare its replay, and use Review and correct to approve the expected total and restore correct replay. Corrected matching lines stay highlighted in both comparison panes. Both playgrounds have adjustable runner widths. Collapsible sections start closed, and reset or scenario selection closes them again. Selecting a runner step opens and highlights its relevant content.

To demonstrate creating a regression test, capture a simulated buggy run, compare the replay, then correct its expected minutes and approve it in browser memory. Approval saves the reviewed fixture and restores correct replay, updating the comparison immediately. The original evidence stays intact. You can download the reviewed `.approved.log` fixture. The implementation fix is simulated; the demo does not modify implementation code or automatically approve fixtures.

All experiments work on browser copies; none of these actions writes to approved files.

The Logs picker offers the same six sleep scenarios as Playground and defaults to the chain of three overlaps. The duplicate recording loads the existing approved log. The other demo recordings are stored in `log-recordings.json`, with input and expected events transcribed from the approved Markdown scenarios. They are labeled as scenario-derived demo recordings, not newly approved log files. Expected events are never generated from the function being tested. Reset returns to the default scenario; restore keeps the selected scenario.
