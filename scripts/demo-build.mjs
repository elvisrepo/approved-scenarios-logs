import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// Compile the demo bundle from the real sources so the showcase page runs the
// exact code the tests guard. tsc emits extensionless relative imports, which
// browsers refuse, so patch them to explicit .js paths afterward.
execSync(
  'node node_modules/typescript/bin/tsc src/mergeSleep.ts src/logMerge.ts --ignoreConfig --target ES2022 --module ES2022 --moduleResolution bundler --strict --skipLibCheck --outDir demo/build',
  { stdio: 'inherit' },
);

const out = 'demo/build/logMerge.js';
writeFileSync(out, readFileSync(out, 'utf8').replace("from './mergeSleep'", "from './mergeSleep.js'"));
console.log('demo build ok');
