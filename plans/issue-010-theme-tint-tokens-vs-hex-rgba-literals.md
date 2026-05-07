# Issue 010 — Hex-alpha string concat + raw `rgba(...)` literals violate theme rule

**Severity**: high
**Area**: ui / theme
**Effort**: small (after issue 030 lands the missing palette tokens)
**Status**: not started

## Files
- `src/ui/cards/V9CardShell.tsx:44, 46, 161, 207, 282, 430`
- `src/ui/cards/VillageBuildingCard.tsx:65`
- `src/ui/mat/Circle.tsx:234, 235`
- `src/ui/domestic/CellSlot.tsx:316`
- `src/ui/hand/Hand.tsx:57`
- `src/theme.ts` — missing tint/alpha tokens

## Problem
CLAUDE.md's hard rule: no raw `#` hex literals outside `theme.ts`. Components
compose colors as `` `${t.palette.role[role].main}1f` `` and use
`bgcolor: 'rgba(255,255,255,0.04)'` directly, smuggling color literals into call
sites. This breaks if a palette token is ever swapped to `rgb(...)` / a named
color, and silently bypasses the theme as the single source of visual tokens.

## Fix sketch
1. In `src/theme.ts`, add per-role tint slots (e.g. `palette.role.<r>.surfaceTint`,
   `palette.role.<r>.surfaceTintStrong`) and surface overlay tokens
   (e.g. `palette.surface.overlay4`, `palette.surface.overlay20`).
2. Replace every offender call-site to use `t.palette.role.<r>.surfaceTint` /
   `t.palette.surface.overlay4`.
3. Add an ESLint rule (or a CI grep step) to forbid `#[0-9a-fA-F]{3,8}` and
   `rgba?\(` outside `src/theme.ts`.

## Acceptance
- Grep for `#` hex in `src/ui/` returns zero matches.
- Grep for `rgba(` in `src/ui/` returns zero matches.
- ESLint or CI catches new violations.

## Related
- (this issue subsumes the prior split between "tokens missing" and "callers
  hex-concat" — they're really one fix in two parts)
