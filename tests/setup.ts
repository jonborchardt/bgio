// Test setup. Wired into Vitest via `setupFiles` in vite.config.ts.
//
// The deck-fixture replacement happens via Vite's resolve.alias (defined
// in vite.config.ts under test.alias), not via vi.mock — module-mock
// hoisting from a setupFile across CJS/ESM interop has been fragile
// across Vitest versions, while resolve.alias is rock-solid.
//
// This file is reserved for cross-cutting test setup (e.g. fake timers,
// global polyfills) and is otherwise empty.
export {};
