# Sleep Merger playground

From the project root:

```sh
npm run demo:build
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/demo/>. Serve the project root so the demo can read the approved examples, logs, source files, and runner diagram.

The playground imports the real merging function and scenario parser from `demo/build/`. Rebuild after changing their TypeScript sources. The page, styles, and interaction code live in `index.html`, `styles.css`, and `demo.js`.

Choose an example, run it, try an incorrect expectation, and restore the correct expectation. The full-suite experiment and editable scenario runner also work on browser copies; none of these actions writes to approved files.
