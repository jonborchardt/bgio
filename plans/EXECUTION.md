# Execution playbook

How to actually drive the work in `/plans` — across sessions, multiple
parallel agents, and stop/restart on token budget. Read this before
implementing anything.

## Bootstrap (once)

This repo is not a git repo yet. Before any sub-plan lands:

1. `git init` at repo root.
2. `git checkout -b main`.
3. `git add . && git commit -m "init: bgio + plans"` — captures the
   starter and the entire `/plans` tree as commit zero.
4. Set `user.name` / `user.email` if not configured.
5. Create [STATUS.md](STATUS.md) — already in this directory; mark every
   row `pending`. **Never** start work without STATUS.md committed.

After bootstrap, every sub-plan lands as exactly one new commit on its
own branch.

## Picking the next sub-plan

1. Read [STATUS.md](STATUS.md). Pick a row with `status: pending` whose
   `blocked_on` column is empty or fully completed.
2. Cross-check the parent stub's **Depends on** list — if any dep is not
   `done` in STATUS.md, skip and pick another.
3. **Claim it.** Update its row to `status: in_progress`, fill `owner`
   (your agent name or "human"), `branch` (e.g. `plan/05.2-contribute-move`),
   and `updated` (ISO date). Commit STATUS.md alone with message
   `chore(status): claim 05.2`. Push if remote exists.
4. Now do the work. The claim is your lock — other agents will skip your
   row until status flips back.

## Branch convention

- One branch per sub-plan: `plan/NN.M-<slug>`. The slug is the kebab-case
  topic in the filename (`05.2-contribute-move.md` → `plan/05.2-contribute-move`).
- Branch off `main` at the point your dependencies are merged.
- One commit per branch by default; multi-commit only when the sub-plan
  itself instructs (rare).
- Merge to `main` via PR (or fast-forward locally for solo work) only
  after the validation gate below passes.

## bgio-first verification gate

Before opening / merging the PR, walk the diff and ask: **is bgio
already doing this?** If a piece of the implementation duplicates a bgio
export (lobby REST, chat, storage interface, log/replay, bot runtime,
spectator routing, random plugin), rip it out and use the bgio export.
The plans encode this stance for stage 10; apply the same lens
everywhere.

If you find yourself writing fetch wrappers, custom plugins, parallel
type interfaces, or move-dispatch proxies, stop and re-check the bgio
docs. The instinct to "wrap" is usually wrong here.

## Definition of done (per sub-plan)

A sub-plan branch is mergeable only when **all** of:

- [ ] Code matches the sub-plan's `## Files` and `## API` sections (or
      the sub-plan was edited to reflect a deliberate deviation).
- [ ] Every test in the sub-plan's `## Tests` section exists and passes.
- [ ] `npm run typecheck && npm run lint && npm test` is green.
- [ ] If the sub-plan touches a UI surface, the dev server boots
      (`npm run dev:full`) and the surface renders without console
      errors.
- [ ] [../CLAUDE.md](../CLAUDE.md) is updated if any convention named
      there shifted (module layout, scripts, hard rules).
- [ ] `STATUS.md` row flipped to `done`, `updated` bumped.
- [ ] One commit, one well-formed message (see below).

## Commit message format

Exactly one commit per sub-plan. Format:

```
NN.M: <imperative summary, < 70 chars>

<2–4 sentence body explaining what this sub-plan delivered and why
the design choice was made if it isn't obvious from the plan.>

Plan: plans/NN.M-<slug>.md
```

Examples:

```
05.2: science contribute move with lowest-first gating

Adds scienceContribute(card, amounts) that pours wallet resources into
a science card's paid ledger, capped at the card's cost and gated by
the lowest-non-completed-per-color rule from game-design.md. Excess
returns to wallet defensively.

Plan: plans/05.2-contribute-move.md
```

```
chore(status): claim 05.2

Marks 05.2 in_progress for agent claude-1 on plan/05.2-contribute-move.
```

The status-update commits and the implementation commit are separate
deliberately: the claim happens *before* the work and is visible to
parallel agents the moment it's pushed.

## Parallel agents

When two or more agents are working at once:

1. Each agent reads STATUS.md, picks a `pending` row whose deps are
   `done`, and claims it via the status commit above.
2. Conflicts are detected at claim time: if your `git push` of the
   status commit is rejected, pull, re-pick, re-claim. Never force-push
   STATUS.md.
3. Independent rows (e.g. 04.1 / 05.2 / 06.2 / 07.2) can run in true
   parallel — different branches, no shared files.
4. Avoid claiming sub-plans that touch overlapping files unless one is
   strictly downstream of the other. STATUS.md's `notes` column is the
   place to flag "touches src/Board.tsx".
5. Agents do not merge each other's branches. Either the human merges
   or each agent merges its own branch in sequence after rebasing on
   `main`.

## Stop / restart protocol

When pausing (token budget, end of session, manual stop):

1. **In the middle of a sub-plan?** Either:
   - Finish if you can in remaining budget — preferred. One sub-plan is
     small enough that finishing is usually the cheapest path.
   - Or: commit work-in-progress on the sub-plan branch with message
     `WIP <NN.M>: <what's left>`. Update STATUS.md `notes` column with
     the resume hint (e.g. "tests written, impl half-done, see WIP
     commit"). Leave `status: in_progress` so other agents don't pick it.
2. **Between sub-plans?** Nothing to do — STATUS.md already reflects
   reality.
3. Push everything (commits + STATUS.md updates).

When resuming:

1. `git pull`.
2. Read STATUS.md for any `in_progress` rows owned by you.
3. If yours is WIP-committed, check out the branch, read the WIP commit
   message, continue.
4. If you have no in-progress claims, pick a fresh `pending` row.

## Token-budget heuristics

These are guidelines for an agent self-pacing implementation:

- A typical sub-plan is one source file (~50–150 lines), one test file
  (~30–80 lines), and a STATUS update. Budget ~3–8k output tokens
  including iteration; ~15–30k input tokens for context.
- If a sub-plan exceeds those by 2x, stop and split it. Don't ship an
  oversized "I just kept going" PR — open a follow-up sub-plan
  (`NN.M.K`), update the parent stub's sub-plan list, and commit the
  split before continuing.
- Heavy sub-plans flagged for a possible split (per earlier
  conversation):
  [07.3](07.3-battle-resolver.md), [08.2](08.2-event-dispatcher.md),
  [10.4](10.4-storage.md), [10.3](10.3-lobby.md),
  [13.3](13.3-database-choice.md). Don't pre-split — split when you
  hit the wall.

## Validation commands (memorize)

```
npm run typecheck       # 01.3 onwards
npm run lint            # 01.3 onwards
npm test                # 01.4 onwards
npm run test:coverage   # 12.6 onwards
npm run dev:full        # 12.7 onwards (the canonical dev loop)
npm run e2e:smoke       # 12.5 onwards
```

If a command doesn't exist yet, the relevant earlier sub-plan hasn't
landed. That's a dependency violation in your pick — back out and
choose differently.

## When to update plans vs. update code

- The plan file is wrong / inadequate → edit the plan file in the same
  branch as the implementation. The merged commit holds both.
- The plan file is right and you can't make it work → stop, escalate to
  human. Do not silently deviate.
- New sub-plans needed (e.g. 05.2 turned into 05.2.1 + 05.2.2 because it
  was too big) → create the new files, update the parent stub's
  sub-plan list, add rows to STATUS.md, all in one commit before
  starting the actual work.

## Never

- Force-push `main`.
- Skip hooks (`--no-verify`).
- Commit secrets (env files, hashes, tokens).
- Mark a row `done` if any test is failing.
- Use `Math.random()` (02.3 bans it; bgio's seeded PRNG only).
- Hand-roll a wrapper around something bgio already exports.
