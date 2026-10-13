# Sleep Merger playground

From the project root:

```sh
npm run demo:build
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/demo/>. Serve the project root so the demo can read the approved examples, logs, source files, and runner diagram.

The playground imports the real merging functions and scenario/log parsers from `demo/build/`. Rebuild after changing their TypeScript sources. The page, styles, and interaction code live in `index.html`, `styles.css`, `demo.js`, and `logs.js`.

In Playground, choose an example, run it, simulate a buggy actual result, and restore the correct result.

In Logs, use the vertical runner on the left to inspect a recording, read its invocation, replay the real `logMerge` function, capture events, and compare the complete log. The content on the right includes readable event cards, JSON lines, and an equivalent traditional test. Simulate a buggy replay with an incorrect actual total, or remove the invocation to see a mismatch or rejected replay, then restore or reset the recording. Both playgrounds have adjustable runner widths and highlight the relevant content when you select a runner step.

All experiments work on browser copies; none of these actions writes to approved files.

The Logs picker offers the same six sleep scenarios as Playground and defaults to the chain of three overlaps. The duplicate recording loads the existing approved log. The other demo recordings are stored in `log-recordings.json`, with input and expected events transcribed from the approved Markdown scenarios. They are labeled as scenario-derived demo recordings, not newly approved log files. Expected events are never generated from the function being tested. Reset returns to the default scenario; restore keeps the selected scenario.
