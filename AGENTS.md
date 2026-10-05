sleep-merger

A small practice project for the Approved Scenarios, Approved Logs and Constrained Tests patterns.

mergeSleep(sessions) takes sleep sessions from several sources (for example a fitbit and a phone) and returns clean, non-overlapping sessions, the total minutes slept, and how many overlaps were merged.

Commands
npm test runs all tests once (Vitest)
npm run typecheck runs the TypeScript compiler without emitting files
Rules for the agent
Approved files are the specification. Never edit anything in scenarios/ or logs/.
If you believe an approved file is wrong, stop and ask. Do not change it to make a test pass.
Do not change the test runners (tests/*.test.ts) in the same pass as an implementation fix.
Implementation code goes in src/. Keep mergeSleep a pure function: no I/O, no logging.