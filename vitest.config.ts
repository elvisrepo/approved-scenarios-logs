import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Project-local vendored skills (symlinks) must never be collected as tests.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,eslint,prettier}.config.*',
      '**/.opencode/**',
      '**/.agents/**',
    ],
  },
});
