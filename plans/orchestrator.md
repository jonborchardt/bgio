# Defense redesign — orchestrator

The protocol document that describes how to complete the full
[Phase 1](./defense-redesign-phase-1.md) →
[Phase 2](./defense-redesign-phase-2.md) →
[Phase 3](./defense-redesign-phase-3.md) plan using subagents,
with persistent status so the work can be paused and resumed.

The orchestrator is **a Claude Code session driving subagents** —
not a separate program. Any session that follows this document
can pick up where the previous session stopped.

---

## How to use this document

When the user says "continue the defense redesign" (or similar),
do this, in order:

1. **Read** [`orchestrator-status.json`](./orchestrator-status.json).
   It is the single source of truth for what is done, in flight,
   blocked, or pending.
2. **Find unblocked work**: any sub-phase whose `status` is
   `pending`, whose every `depends_on` entry has `status =
   completed`, and which is not currently `in-progress`.
3. **Decide how many to launch in parallel**: see §3 below for
   the DAG. Only launch sub-phases listed in the same
   `parallel_group`.
4. **For each launched sub-phase**:
   - Mark its entry `status: in-progress` with a fresh
     `started_at` timestamp.
   - Spawn a subagent using the `Agent` tool with the prompt
     template in §5. **Use the `isolation: "worktree"` flag** if
     two or more sub-phases will run in parallel — bgio's `src/`
     gets touched by every sub-phase and worktrees are the
     simplest way to avoid stomping.
   - Record the worktree path / branch in the status entry.
5. **When an agent returns**: run the verification gates in §6.
   - **Pass** → run the **commit step** in §6.5, then mark
     `status: completed`, record `completed_at`, save `summary`
     from the agent's report.
   - **Fail** → mark `status: review`, record the failure detail
     in `notes`, and surface to the user. Do not auto-retry. Do
     not commit a failing sub-phase.
6. **After updating status**, look for newly-unblocked sub-phases
   and repeat from step 2 until either everything is done, the
   user pauses, or a sub-phase is stuck in `review`.

The orchestrator session writes only `orchestrator-status.json`
and (optionally) a small running narrative in
`orchestrator-log.md`. It does **not** write code itself — the
subagents do that.

---

## 2. The status file

[`orchestrator-status.json`](./orchestrator-status.json) holds one
entry per sub-phase. Schema:

```json
{
  "version": 1,
  "updated_at": "ISO timestamp",
  "subphases": {
    "1.1": {
      "id": "1.1",
      "title": "Content schema extensions",
      "plan_path": "plans/defense-redesign-1.1-content-schema.md",
      "status": "pending",
      "depends_on": [],
      "parallel_group": "phase-1-serial",
      "started_at": null,
      "completed_at": null,
      "worktree": null,
      "branch": null,
      "summary": null,
      "notes": []
    }
  }
}
```

Allowed `status` values: `pending`, `in-progress`, `review`,
`completed`, `failed`, `blocked`.

- `pending` → ready to be picked up if all `depends_on` are
  `completed`.
- `in-progress` → an agent is working it now.
- `review` → an agent finished but verification gates didn't
  fully pass; the user must look.
- `completed` → fully verified, gates green.
- `failed` → a hard failure that needs design / scope rethink.
- `blocked` → a `depends_on` entry is itself in `failed` or
  `review`; orchestrator skips this until upstream resolves.

The orchestrator updates this file via Read + Edit (or Write
when adding fields). Keep edits small to avoid clobbering
parallel agent updates.

---

## 3. Dependency DAG and parallel groups

Sub-phase IDs are the keys in the status file. Edges below mean
"X must be `completed` before Y starts."

```
Phase 1 (serial)
  1.1 → 1.2 → 1.3 → 1.4 → 1.5

Phase 2 (mostly serial)
  1.5 → 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7 → 2.8

Phase 3 (parallelizable in waves)
  2.8 → 3.1, 3.2, 3.5, 3.7         (wave A)
  3.1 + 3.2 → 3.3, 3.6              (wave B)
  3.3 → 3.4, 3.8                    (wave C)
  3.1..3.8 all completed → 3.9      (wave D — solo)
```

**Parallel groups** (used when picking what to launch
simultaneously):

- `phase-1-serial` — 1.1, 1.2, 1.3, 1.4, 1.5 (one at a time).
- `phase-2-serial` — 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8 (one
  at a time).
- `phase-3-wave-a` — 3.1, 3.2, 3.5, 3.7 (up to 4 parallel).
- `phase-3-wave-b` — 3.3, 3.6 (up to 2 parallel).
- `phase-3-wave-c` — 3.4, 3.8 (up to 2 parallel).
- `phase-3-wave-d` — 3.9 (solo).

Phase 1 + Phase 2 are serial because each sub-phase reshapes
state that the next one assumes — running them in parallel would
just produce merge conflicts on the same files. Phase 3 splits
cleanly because most sub-phases edit different UI files.

**Recommended max parallelism = 3** even when the wave allows
more. Watching three subagents is the upper bound of useful
context and the user wants to be able to follow.

---

## 4. Worktrees and merge protocol

When more than one sub-phase runs at once, isolate each in a git
worktree:

- Pass `isolation: "worktree"` to the `Agent` call.
- Capture the returned worktree path + branch in the status
  entry.
- When the agent returns, run verification gates against the
  worktree.
- On pass: merge the branch into the parent branch (currently
  `plan`), record the merge SHA in `notes`, then clean up the
  worktree.
- On fail: leave the worktree in place for the user to inspect;
  status is `review`.

If only one sub-phase is in flight, skip the worktree (work on
the parent branch directly) — the cost-benefit doesn't justify
worktree overhead for serial work.

Merge order matters for Phase 3 waves: merge `wave-a` outputs
serially (3.1, then 3.2, then 3.5, then 3.7) so the combined
state is clean before launching `wave-b`. The orchestrator
gates the next wave only on all of the previous wave being
`completed`.

---

## 5. Subagent prompt template

When launching an agent for sub-phase `X.Y`, use this prompt
verbatim, with substitutions:

```text
You are implementing sub-phase {X.Y} of the defense redesign.

Read these in order:
1. plans/defense-redesign-{X.Y}-{slug}.md — your task
2. reports/defense-redesign-spec.md — the canonical spec; the
   sub-phase plan references decision IDs (D1, D2, …) defined
   here
3. plans/defense-redesign-phase-{X}.md — the parent phase
   outline so you know how your work fits

Your deliverable is the sub-phase's "Done when" criteria fully
met:
- Code changes implemented per the plan's "Files touched" and
  "Concrete changes" sections
- Tests added per the "Test plan" section
- Docs updated where the plan says to
- All commands green: npm run typecheck, npm run lint, npm test,
  npm run build
- A single git commit at the end with all of this sub-phase's
  changes. Do NOT push. Commit message format:
    defense-redesign {X.Y}: {one-line title from the plan}

    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

  If verification gates fail, do not commit — fix or report back
  for the orchestrator to mark `review`.

Constraints (from CLAUDE.md):
- TypeScript strict + verbatimModuleSyntax — `import type` for
  type-only imports; keep .ts/.tsx extensions on relative imports
- ESLint bans Math.random in src/ — use src/game/random.ts
- All UI styling via MUI sx / styled, no raw hex literals outside
  src/theme.ts
- boardgame.io is the engine — use built-ins (phases, turn.stages,
  PluginRandom, playerView) before hand-rolling anything

Do NOT:
- Touch sub-phases other than {X.Y}
- Skip the verification commands
- Add backwards-compat shims; the redesign is opinionated
- Silently mark "good enough" — flag anything that doesn't pass
  the Done criteria

Report back:
- Brief summary of what you implemented
- List of files created / edited / deleted
- Output of the four verification commands (just pass/fail +
  any failing test names)
- Any open questions for the orchestrator
```

The agent receives this prompt with the X.Y slug filled in. The
sub-phase plan it reads is self-contained; it should not need
the orchestrator to clarify scope.

---

## 6. Verification gates

After an agent returns, the orchestrator runs (or asks the agent
to confirm it ran) the following commands inside the agent's
worktree (or the parent branch if no worktree):

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For Phase 3 sub-phases that touch e2e:

```bash
npm run e2e:smoke
```

**All gates must pass** for the sub-phase to be marked
`completed`. Any failure → `review`.

In addition, sub-phase-specific gates:

- **1.4** — grep `\bforeign\b` across `src/` and `tests/`
  must return only deletions (no live references). Allow
  matches in `docs/` until 1.5.
- **1.5** — grep `settlementsJoined`, `tradeRequest`,
  `BattleInFlight` across `src/`, `tests/`, `docs/` must return
  zero live references.
- **2.7** — a scripted full-track bot run must produce at least
  one `won: true` outcome out of N trials (N = 5).
- **3.9** — the e2e smoke must complete a full match end-to-end.

These are documented in each sub-phase's "Done when" section;
the orchestrator just enforces them programmatically.

### 6.5 Commit step (after gates pass)

After all gates pass for a sub-phase X.Y, the agent (or the
orchestrator if the agent forgot) creates **exactly one commit**
containing all of that sub-phase's changes:

```bash
git add <files modified by this sub-phase>
git commit -m "$(cat <<'EOF'
defense-redesign {X.Y}: {one-line title from the plan}

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Rules:

- **One commit per sub-phase.** Not per file, not per logical
  chunk — one commit ties the sub-phase ID to a single SHA so
  the orchestrator status entry can reference it.
- **No push.** Pushing happens only when the user says so.
- **No `--no-verify`.** Hooks must pass.
- **No amending** an earlier sub-phase's commit. Each sub-phase
  produces a new commit on top.
- The orchestrator records the resulting SHA in
  `subphases[X.Y].notes` for traceability.

For Phase 3 worktree-isolated sub-phases, the commit lands on
the sub-phase branch in the worktree. The merge into the parent
branch (per §4) is a separate operation logged separately.

---

## 7. Resume protocol (start / stop / start)

When the user pauses:

- Any agent currently in flight finishes its current step (don't
  interrupt mid-edit).
- Status entries that were `in-progress` but not yet verified
  stay as `in-progress`. The orchestrator records their state
  and exits.

When the user restarts:

- Read `orchestrator-status.json`.
- For each `in-progress` entry, ask the user: "Sub-phase X.Y
  was in flight when we stopped. Resume it (re-run the agent),
  retire it (revert + mark pending), or accept its current
  state (run gates, mark completed/review)?"
- For all other entries, follow the normal protocol from §1.

Status file is committed to git alongside code changes so the
state is portable across machines.

---

## 8. Failure modes and escalation

When to stop and ask the user instead of continuing:

- Any sub-phase ending in `review` or `failed`. The user has to
  look at the diff before the orchestrator can decide whether
  to mark it completed (e.g. one flaky test) or to redesign
  (e.g. an unforeseen architectural conflict).
- A verification gate failure that recurs across two retries.
- A sub-phase whose plan turns out to be wrong (the agent
  reports "this can't be done as written"). Update the plan,
  ask the user, then re-launch.
- A merge conflict between parallel Phase-3 worktree branches.
  Resolve interactively, don't auto-resolve.

The orchestrator never:

- Modifies plan files (those are the contract).
- Modifies the spec (`reports/defense-redesign-spec.md`).
- Skips a verification gate.
- Runs `git push` without explicit user instruction.

---

## 9. Quick start — what the user types

To **start from scratch** (or resume — the orchestrator handles
both the same way):

> **`run the defense-redesign orchestrator`**

or any close paraphrase: "continue the defense redesign,"
"start the defense plan," "drive the next sub-phase."

The orchestrator (the Claude Code session) responds by:

```text
  1. Read plans/orchestrator-status.json.
  2. Find first pending sub-phase whose deps are all completed.
     - First run: 1.1 (no deps).
     - Resume run: whatever is next per the DAG.
  3. Mark in-progress, spawn subagent with the §5 prompt.
  4. Wait for return.
  5. Run §6 gates. If fail → mark review, surface to user.
  6. Run §6.5 commit step (one commit per sub-phase).
  7. Update status (record SHA in notes), loop to step 2.
```

### Common variants

- **Just one sub-phase:** "run sub-phase 1.1 only" → orchestrator
  runs that one and stops, even if deps clear more downstream.
- **Up to N parallel:** "run the next wave with up to 3 in
  parallel" → orchestrator obeys the DAG but launches N
  worktree-isolated agents at once when a parallel group allows.
- **Pause:** "stop the orchestrator" → finish in-flight agents,
  update status, exit. Resume later with the start command.
- **Inspect:** "what's the orchestrator status?" → orchestrator
  reads the status file and reports a brief summary
  (completed / in-progress / pending / review counts + the next
  pending sub-phase).
- **Reset a stuck entry:** "reset sub-phase X.Y to pending" →
  orchestrator clears the status fields for that entry; the
  user is responsible for any code rollback.

The first time you kick this off, expect the orchestrator to
ask for confirmation before launching the first agent — that's
the one moment where it pauses to make sure the user wants to
proceed (Phase 1 is destructive: 1.4 deletes a lot of code).

The orchestrator session can run agents in the background
(`run_in_background: true` on the Agent tool) when the user
explicitly says "run the next several in the background." The
default is foreground, sequential — the user wants to follow
along.

---

## 10. What NOT to put on the orchestrator

Things the orchestrator does not do, even though they're
related:

- **Content tuning.** Boss thresholds, phase difficulty curves,
  unit cost tweaks — all post-3.9 follow-up work.
- **Networked-mode validation.** A separate plan, after the
  hot-seat path is solid.
- **Bot quality improvements (MCTS).** Listed as Phase 3.9
  closeout follow-up.
- **Big science redesign.** A separate plan series the user has
  queued for later.
- **Renaming the project codename "Settlement."** Deferred per
  CLAUDE.md project stance.

If the user asks "do X" and X is on this list, the orchestrator
politely declines and points back here.
