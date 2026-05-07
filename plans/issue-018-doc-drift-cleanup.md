# Issue 018 — Documentation drift: README + CLAUDE.md vs reality

**Severity**: medium
**Area**: docs
**Effort**: small
**Status**: not started

## Files
- `README.md:76-117` — layout block omits `src/game/library/`, mentions retired `SCIENCE_CARDS`, includes deleted dirs
- `CLAUDE.md` — references `src/ui/chat/` (does not exist; no `client.chatMessages` wired)
- `CLAUDE.md` — Layout block omits `src/game/graveyard.ts`, `src/game/undo.ts`, `src/game/requests/`
- `Board.tsx:3-7` — top-comment describes a Header that's not rendered + chat that's not rendered
- `card-sweep-after-pick.png`, `card-sweep-mui.png` — at repo root, referenced nowhere

## Problem
Multiple authoritative docs reference paths or modules that no longer exist (or
that exist but aren't mentioned). This compounds future-AI confusion (CLAUDE.md
is the project's brief) and onboarding friction.

## Fix sketch
Single-PR sweep:
1. README.md layout block — add `library/`, `centralBoard/`, `track/`; remove
   `SCIENCE_CARDS` and any other retired symbols.
2. CLAUDE.md — remove `src/ui/chat/`; add lines for `graveyard.ts`, `undo.ts`,
   `requests/` (or retire `requests/` per issue 012).
3. `Board.tsx` doc-comment — sync with actual JSX (no header, no chat) OR add the
   missing pieces.
4. Move `card-sweep-*.png` to `screenshots/` and link from a doc, or delete.

## Acceptance
- Every path mentioned in README + CLAUDE.md exists.
- Every top-level dir in `src/` is listed in CLAUDE.md (or intentionally omitted with reason).
- Repo root has no orphan PNGs.

## Related
- 012 (`requests/` retire-or-document is part of this)
- 052 (stale screenshots — folded in here)
