# Sleep Merger playground

From the project root:

```sh
npm run demo:build
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/demo/>. Serve the project root so the demo can read the approved examples, logs, source files, and runner diagram.

The playground imports the real merging functions and scenario/log parsers from `demo/build/`. Rebuild after changing their TypeScript sources. The page, styles, and interaction code live in `index.html`, `styles.css`, `demo.js`, and `logs.js`.

In Playground, choose an example, run it, try an incorrect expectation, and restore the correct expectation.

In Logs, use the vertical runner on the left to inspect a recording, read its invocation, replay the real `logMerge` function, capture events, and compare the complete log. The content on the right includes readable event cards, JSON lines, and an equivalent traditional test. Try an incorrect total or remove the invocation to see a mismatch or rejected replay, then restore or reset the recording. Both playgrounds have adjustable runner widths and highlight the relevant content when you select a runner step.

All experiments work on browser copies; none of these actions writes to approved files.
