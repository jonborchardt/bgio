// Defense redesign 3.2 — BuildingTile.
//
// Per-tile renderer for an occupied (non-center) cell on the domestic
// grid. Wraps three concerns:
//
//   - the existing BuildingCard (name + benefit + adjacency rules)
//   - an HpPips row pinned to the card header so current/maxHp reads
//     in-line at a glance
//   - a UnitStack overlay anchored to the right edge of the tile
//     (units placed on this building, oldest visually-bottom)
//
// Damage / repair flash:
//   When `building.hp` decreases between renders we briefly tint the
//   tile red; when it increases we briefly tint it green. Implemented
//   via a small `useState` + `useEffect` pair that schedules a
//   ≤ 250 ms `setTimeout` to clear the tint. No animation library is
//   needed — a single CSS transition on `boxShadow` covers the visual.
//
// All visual choices route through theme tokens; no raw hex literals
// (CLAUDE.md rule).

import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import type { BuildingDef } from '../../data/schema.ts';
import type { DomesticBuilding } from '../../game/roles/domestic/types.ts';
import type { UnitInstance } from '../../game/roles/defense/types.ts';
import { BuildingCard } from '../cards/BuildingCard.tsx';
import { HpPips } from './HpPips.tsx';
import { UnitStack } from './UnitStack.tsx';
import { useReducedMotion } from '../layout/useReducedMotion.ts';

export interface BuildingTileProps {
  building: DomesticBuilding;
  /** Resolved BuildingDef for this tile. Optional so the rare def-
   *  missing fallback can render a shrug-tile instead of crashing. */
  def?: BuildingDef;
  /** Units placed on this tile (filtered upstream by `cellKey`). */
  units?: UnitInstance[];
  /** Set of orthogonal-neighbor defIDs forwarded to BuildingCard so
   *  adjacency rules paint as currently-firing. */
  activeNeighbors?: ReadonlySet<string>;
}

const FLASH_DURATION_MS = 250;

type FlashState = 'damage' | 'repair' | null;

export function BuildingTile({
  building,
  def,
  units,
  activeNeighbors,
}: BuildingTileProps) {
  // Track the previous HP between renders so we can detect deltas and
  // schedule a damage / repair flash when one occurs. `useRef` avoids a
  // re-render loop — we only want the side-effect when the parent
  // re-renders with a new HP value.
  const prevHpRef = useRef<number>(building.hp);
  const [flash, setFlash] = useState<FlashState>(null);
  // Defense redesign 3.9 — respect prefers-reduced-motion. With reduced
  // motion the flash never fires; the HP pip swap (and the contextual
  // tooltip) is enough to communicate the state change.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const prev = prevHpRef.current;
    const next = building.hp;
    if (next < prev) {
      setFlash(reducedMotion ? null : 'damage');
    } else if (next > prev) {
      setFlash(reducedMotion ? null : 'repair');
    }
    prevHpRef.current = next;
  }, [building.hp, reducedMotion]);

  useEffect(() => {
    if (flash === null) return;
    const handle = window.setTimeout(() => setFlash(null), FLASH_DURATION_MS);
    return () => {
      window.clearTimeout(handle);
    };
  }, [flash]);

  const flashBoxShadow = (() => {
    if (flash === 'damage') {
      return (t: import('@mui/material/styles').Theme) =>
        `0 0 0 3px ${t.palette.status.critical}`;
    }
    if (flash === 'repair') {
      return (t: import('@mui/material/styles').Theme) =>
        `0 0 0 3px ${t.palette.status.healthy}`;
    }
    return undefined;
  })();

  return (
    <Box
      data-building-tile="true"
      data-building-def={building.defID}
      data-building-hp={building.hp}
      data-building-max-hp={building.maxHp}
      data-flash={flash ?? 'none'}
      sx={{
        position: 'relative',
        width: '100%',
        borderRadius: 1.5,
        // The flash is a colored ring around the whole tile via
        // boxShadow — it doesn't shift layout and clears in ≤ 250 ms.
        boxShadow: flashBoxShadow,
        transition: `box-shadow ${FLASH_DURATION_MS}ms`,
      }}
    >
      {/* Name-row HP pip overlay. We anchor it at the top-right of the
          tile so it reads next to the building's title without
          competing with the card's body content. */}
      <Box
        sx={{
          position: 'absolute',
          top: 6,
          right: 6,
          zIndex: 2,
          // Pad the pip group so it contrasts against the card surface.
          bgcolor: (t) => t.palette.appSurface.base,
          borderRadius: 999,
          px: 0.5,
          py: 0.25,
          boxShadow: (t) => t.palette.shadow.card,
        }}
      >
        <HpPips current={building.hp} max={building.maxHp} />
      </Box>

      {/* The card itself. */}
      {def ? (
        <BuildingCard
          def={def}
          count={building.upgrades > 0 ? building.upgrades + 1 : undefined}
          size="normal"
          activeNeighbors={activeNeighbors}
        />
      ) : (
        <Box
          sx={{
            p: 1,
            color: (t) => t.palette.status.muted,
            fontStyle: 'italic',
            fontSize: '0.8rem',
          }}
        >
          {building.defID}
        </Box>
      )}

      {/* UnitStack — overlay along the right edge so it stays out of
          the BuildingCard body. Hidden when no units are placed here. */}
      {units && units.length > 0 ? (
        <Box
          sx={{
            position: 'absolute',
            top: 36,
            right: 4,
            width: '60%',
            maxWidth: 130,
            zIndex: 1,
          }}
        >
          <UnitStack units={units} />
        </Box>
      ) : null}
    </Box>
  );
}

export default BuildingTile;
