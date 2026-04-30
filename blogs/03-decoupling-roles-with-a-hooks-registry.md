# Decoupling roles with a tiny hooks registry

End-of-round in Settlement does a lot of small things at once. The
science role's grid refills. The domestic role tallies upkeep. The
foreign role redraws its battle deck. The opponent's wander deck cycles.
Each one is owned by a different folder under
[src/game/roles/](src/game/roles/), and each one wants to run at the
same moment: the start of `endOfRound.onBegin`.

The naive shape is one big `endOfRound` file that imports from each
role and calls them in sequence. That folder structure couples every
role to every other role through one orchestrator. Touch the orchestrator
to add a step, touch it again to reorder.

Instead, [src/game/hooks.ts](src/game/hooks.ts) is a 25-line registry:

```ts
const hooks = new Map<string, RoundEndHook>();

export const registerRoundEndHook = (name, hook) => {
  const existing = hooks.get(name);
  if (existing !== undefined) {
    if (existing === hook) return;       // idempotent on same ref
    throw new Error(`a different hook is already registered under "${name}"`);
  }
  hooks.set(name, hook);
};
```

Each role module calls `registerRoundEndHook('science.refillGrid', fn)`
at module-evaluation time. `endOfRound.onBegin` calls `runRoundEndHooks`,
which iterates the `Map` in insertion order. No role imports another
role; the orchestrator imports nothing role-specific.

Two design choices in that 25 lines are worth noting.

**Idempotent on `(name, fn-ref)`.** Re-registering the same name with
the same function reference is a silent no-op. Vite's HMR re-evaluates
modules; tests sometimes import a role twice. We don't want either to
throw. But re-registering the same name with a *different* reference
throws — because that's almost always a name collision between two
modules trying to claim the same slot, and we want it loud.

**Hooks are wrapped in `try/catch` per call.** The registry's runner
([src/game/hooks.ts:75-87](src/game/hooks.ts#L75-L87)) `console.error`s a
hook that throws and continues to the next one. End-of-round bookkeeping
is the worst place to abort the whole sweep over one buggy hook — half
the round-end state would be applied and half wouldn't. The contract
is: a buggy hook degrades that one bookkeeping step, not the round.

The trade-off is real. The registry hides ordering: you can't tell from
reading [src/game/phases/endOfRound.ts](src/game/phases/endOfRound.ts)
what runs at end-of-round, only that *something does*. We accept that
because a `Map`'s insertion order plus a grep for `registerRoundEndHook`
gets you the answer in two seconds, and the win — role folders that don't
import each other — pays for it forever.

This is a pattern boardgame.io itself uses (`PluginPlayer`, `PluginRandom`
register against the engine, not against each other). Inside the game,
the same shape gives us role independence for free.
