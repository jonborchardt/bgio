// Lint fixture for tests/randomness.test.ts.
//
// This file exists ONLY so the `no-restricted-properties` ESLint rule has
// something to fire on. Do not import it from app code, do not "fix" the
// Math.random call below — its job is to be the canary that confirms our
// determinism guard is wired up.
//
// Lives under tests/fixtures/ so it never enters the Vite build, and the
// default tests/** ESLint carve-out keeps `npm run lint` green even though
// the call below would otherwise trip the rule. The randomness test
// re-enables the rule programmatically when it lints this file.

export const x = Math.random();
